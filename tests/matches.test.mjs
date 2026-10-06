import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
test('matches persist atomically and enforce guest, member and administrator access',async()=>{
 const mf=new Miniflare({scriptPath:new URL('../worker/index.mjs',import.meta.url).pathname,modules:true,modulesRules:[{type:'ESModule',include:['**/*.mjs']}],compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:{AUTH_PEPPER:'test-pepper-12345678901234567890123456789',ADMIN_SETUP_TOKEN:'test-setup-12345678901234567890123456789'}});
 try{
 const db=await mf.getD1Database('DB');
 for(const file of ['0001_independent_accounts.sql','0002_matches.sql'])for(const sql of (await readFile(new URL('../migrations/'+file,import.meta.url),'utf8')).split(';'))if(sql.trim())await db.prepare(sql).run();
 async function req(path,body,cookie='',origin='https://team.test'){const r=await mf.dispatchFetch('https://team.test/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('Set-Cookie')?.split(';')[0]};}
 const owner=(await req('account/register',{username:'owner',password:'strong-password-2026',code:'test-setup-12345678901234567890123456789',nickname:'队长'})).cookie;
 const invite=await req('account/invite',{role:'player'},owner);
 const member=(await req('account/register',{username:'member',password:'strong-password-2026',code:invite.data.code,nickname:'队员'})).cookie;
 const match={title:'训练对局',opponent:'另一支校队',kind:'scrim',playedOn:'2026-10-06',published:false,rounds:[{number:1,side:'hunter',map:'红教堂',teamScore:3,opponentScore:1,picks:[{playerId:'p0001',character:'红夫人'}],bans:['佣兵']}]};
 assert.equal((await req('matches/save',match)).status,401);
 assert.equal((await req('matches/save',match,member)).status,403);
 assert.equal((await req('matches/save',match,owner,'https://evil.test')).status,403);
 assert.equal((await req('matches/list')).status,401);
 const saved=await req('matches/save',match,owner);assert.equal(saved.status,200);
 assert.equal((await req('matches/public')).data.matches.length,0);
 const listing=await req('matches/list',undefined,member);assert.equal(listing.data.matches.length,1);assert.equal(listing.data.canManage,false);assert.equal(listing.data.matches[0].rounds[0].picks[0].character,'红夫人');
 assert.equal((await req('matches/save',{...match,id:saved.data.id,published:true},owner)).status,200);
 assert.equal((await req('matches/public')).data.matches.length,1);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM match_rounds').first()).n,1);
 assert.equal((await req('matches/save',{...match,id:saved.data.id,rounds:[{...match.rounds[0],teamScore:4,opponentScore:0}]},owner)).status,400);
 assert.equal((await req('matches/public')).data.matches.length,1);
 assert.equal((await req('matches/delete',{id:saved.data.id},member)).status,403);
 assert.equal((await req('matches/delete',{id:saved.data.id},owner)).status,200);
 assert.equal((await req('matches/public')).data.matches.length,0);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM match_picks').first()).n,0);
 assert.equal((await req('account/audit',undefined,member)).status,403);
 assert.ok((await req('account/audit',undefined,owner)).data.rows.some(r=>r.action==='save_match'));
 }finally{await mf.dispose();}
});
