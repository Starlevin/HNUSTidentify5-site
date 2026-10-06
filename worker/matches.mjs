import legacyRoster from './roster.mjs';
import { currentMember } from './auth.mjs';
import { HttpError, text, sameOrigin, payload, json, randomToken } from './credentials.mjs';
const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
const administrator = user => { if (!['owner','admin'].includes(user.role)) throw new HttpError(403, '仅管理员可管理比赛'); };
function required(value, max) { const result = text(value, max); if (!result) throw new HttpError(400, '请填写比赛必填信息'); return result; }
function validate(input) {
  const title = required(input.title, 80), opponent = required(input.opponent, 80);
  const kind = text(input.kind, 20), date = text(input.playedOn, 10);
  if (!['official','scrim','friendly','campus'].includes(kind)) throw new HttpError(400, '请选择比赛类型');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new HttpError(400, '比赛日期不正确');
  if (!Array.isArray(input.rounds) || !input.rounds.length || input.rounds.length > 20) throw new HttpError(400, '请添加 1–20 条半场记录');
  const seen = new Set();
  const rounds = input.rounds.map(r => {
    if (!r || !Number.isInteger(r.number) || r.number < 1 || r.number > 10 || !['survivor','hunter'].includes(r.side)) throw new HttpError(400, '半场编号或阵营不正确');
    const key = r.number + ':' + r.side; if (seen.has(key)) throw new HttpError(400, '同一局同一阵营不能重复录入'); seen.add(key);
    if (![r.teamScore,r.opponentScore].every(n => Number.isInteger(n) && n >= 0 && n <= 5)) throw new HttpError(400, '半场分数须为 0–5 的整数');
    // Identity V escape/elimination scoring, including the 5:0 sweep.
    if (!['5:0','3:1','2:2','1:3','0:5'].includes(r.teamScore + ':' + r.opponentScore)) throw new HttpError(400, '半场比分须为 5:0、3:1、2:2、1:3 或 0:5');
    if (!Array.isArray(r.picks) || r.picks.length !== (r.side === 'survivor' ? 4 : 1)) throw new HttpError(400, '求生者半场须录入4人，监管者半场须录入1人');
    const picks = r.picks.map(p => ({playerId: required(p.playerId,20), character: required(p.character,40)}));
    if (new Set(picks.map(p=>p.playerId)).size !== picks.length || picks.some(p=>!/^p[0-9]{4,8}$/.test(p.playerId))) throw new HttpError(400, '上场队员编号无效或重复');
    if (!Array.isArray(r.bans) || r.bans.length > 12) throw new HttpError(400, 'Ban记录格式不正确');
    return {...r, map:required(r.map,40), picks, bans:r.bans.map(c=>required(c,40))};
  });
  return {title, opponent, kind, date, published:input.published === true ? 1 : 0, rounds};
}
async function load(db, publicOnly) {
  const matches = (await q(db,'SELECT id,title,opponent,kind,played_on,published FROM team_matches '+(publicOnly?'WHERE published=1 ':'')+'ORDER BY played_on DESC,created DESC LIMIT 100').all()).results;
  // Join publication filters into every query so private match data is never loaded for guests.
  const filter = publicOnly ? 'WHERE m.published=1 ' : '';
  const rounds = (await q(db,'SELECT r.* FROM match_rounds r JOIN team_matches m ON m.id=r.match_id '+filter+'ORDER BY round_number,side').all()).results;
  const picks = (await q(db,'SELECT p.* FROM match_picks p JOIN match_rounds r ON r.id=p.round_id JOIN team_matches m ON m.id=r.match_id '+filter+'ORDER BY position').all()).results;
  const bans = (await q(db,'SELECT b.* FROM match_bans b JOIN match_rounds r ON r.id=b.round_id JOIN team_matches m ON m.id=r.match_id '+filter+'ORDER BY position').all()).results;
  return matches.map(m=>({...m,rounds:rounds.filter(r=>r.match_id===m.id).map(r=>({...r,picks:picks.filter(p=>p.round_id===r.id),bans:bans.filter(b=>b.round_id===r.id).map(b=>b.character)}))}));
}
export async function handleMatches(request, env) {
  try {
    if (!env.DB) throw new HttpError(503,'比赛服务尚未配置');
    const path = new URL(request.url).pathname.replace('/api/matches/','');
    if (request.method === 'GET' && path === 'public') return json({matches:await load(env.DB,true)});
    const user = await currentMember(request,env);
    if (request.method === 'GET' && path === 'list') return json({matches:await load(env.DB,false),canManage:['owner','admin'].includes(user.role)});
    if (request.method !== 'POST') throw new HttpError(405,'不支持此请求方式');
    sameOrigin(request); administrator(user); const body = await payload(request), db = env.DB;
    const id = body.id ? required(body.id,64) : randomToken(12);
    if (path === 'save') {
      const m = validate(body);
      const known = new Set(legacyRoster.map(p=>p.id));
      const users = (await q(db, 'SELECT player_id FROM account_users WHERE active=1').all()).results;
      users.forEach(u=>known.add(u.player_id));
      if (m.rounds.some(r=>r.picks.some(p=>!known.has(p.playerId)))) throw new HttpError(400, '上场队员必须是现有校队档案');
      const batch = [q(db,'INSERT INTO team_matches(id,title,opponent,kind,played_on,published,created_by,created,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,opponent=excluded.opponent,kind=excluded.kind,played_on=excluded.played_on,published=excluded.published,updated=excluded.updated',id,m.title,m.opponent,m.kind,m.date,m.published,user.id,Date.now(),Date.now()),q(db,'DELETE FROM match_picks WHERE round_id IN (SELECT id FROM match_rounds WHERE match_id=?)',id),q(db,'DELETE FROM match_bans WHERE round_id IN (SELECT id FROM match_rounds WHERE match_id=?)',id),q(db,'DELETE FROM match_rounds WHERE match_id=?',id)];
      for (const r of m.rounds) {
        batch.push(q(db,'INSERT INTO match_rounds(match_id,round_number,side,map,team_score,opponent_score) VALUES(?,?,?,?,?,?)',id,r.number,r.side,r.map,r.teamScore,r.opponentScore));
        r.picks.forEach((p,i)=>batch.push(q(db,'INSERT INTO match_picks(round_id,position,player_id,character) SELECT id,?,?,? FROM match_rounds WHERE match_id=? AND round_number=? AND side=?',i,p.playerId,p.character,id,r.number,r.side)));
        r.bans.forEach((b,i)=>batch.push(q(db,'INSERT INTO match_bans(round_id,position,character) SELECT id,?,? FROM match_rounds WHERE match_id=? AND round_number=? AND side=?',i,b,id,r.number,r.side)));
      }
      batch.push(q(db,'INSERT INTO account_audit(actor,action,target,created) VALUES(?,?,?,?)',user.id,'save_match',id,Date.now()));
      await db.batch(batch); return json({ok:true,id});
    }
    if (path === 'delete') {
      await db.batch([q(db,'DELETE FROM match_picks WHERE round_id IN (SELECT id FROM match_rounds WHERE match_id=?)',id),q(db,'DELETE FROM match_bans WHERE round_id IN (SELECT id FROM match_rounds WHERE match_id=?)',id),q(db,'DELETE FROM match_rounds WHERE match_id=?',id),q(db,'DELETE FROM team_matches WHERE id=?',id),q(db,'INSERT INTO account_audit(actor,action,target,created) VALUES(?,?,?,?)',user.id,'delete_match',id,Date.now())]);
      return json({ok:true});
    }
    throw new HttpError(404,'接口不存在');
  } catch(error) {
    if (error instanceof HttpError) return json({error:error.message},error.status);
    console.error('Match operation failed');return json({error:'比赛服务暂时不可用，请稍后重试'},503);
  }
}
