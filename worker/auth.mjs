import { HttpError, COOKIE, SESSION_MS, digest, equal, randomToken, username, password, passwordHash, text, sessionCookie, readCookie, sameOrigin, payload, json } from './credentials.mjs';

import legacyRoster from './roster.mjs';
const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
export async function currentMember(request, env, required = true) {
  const token = readCookie(request);
  const user = token ? await stmt(env.DB, 'SELECT u.id,u.username,u.role,u.active,u.player_id FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1', await digest(token), Date.now()).first() : null;
  if (!user && required) throw new HttpError(401, '请先登录校队账号');
  return user;
}
function admin(user, ownerOnly = false) {
  if (!(ownerOnly ? user.role === 'owner' : ['owner', 'admin'].includes(user.role))) throw new HttpError(403, '没有此操作权限');
}
async function rate(db, key, limit) {
  const window = Math.floor(Date.now() / 900000);
  const row = await stmt(db, 'INSERT INTO account_attempts(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count', key, window).first();
  if (row.count > limit) throw new HttpError(429, '尝试过于频繁，请 15 分钟后再试');
}
async function session(env, userId) {
  const token = randomToken();
  await stmt(env.DB, 'INSERT INTO account_sessions(token_hash,user_id,expires) VALUES(?,?,?)', await digest(token), userId, Date.now() + SESSION_MS).run();
  return token;
}
async function audit(db, actor, action, target) {
  await stmt(db, 'INSERT INTO account_audit(actor,action,target,created) VALUES(?,?,?,?)', actor, action, String(target), Date.now()).run();
}
function publicProfile(input) {
  const role = text(input.role, 20) || 'survivor';
  if (!['survivor', 'hunter', 'flex', 'support'].includes(role)) throw new HttpError(400, '请选择阵营');
  const theme = text(input.theme, 20) || 'gold';
  if (!['gold', 'blue', 'crimson'].includes(theme)) throw new HttpError(400, '请选择主页主题');
  const featured = text(input.featured, 40) || (role === 'hunter' ? 'bloody-queen' : 'mercenary');
  if (!['mercenary', 'bloody-queen'].includes(featured)) throw new HttpError(400, '请选择已收录的角色立绘');
  const nickname = text(input.nickname, 32);
  if (!nickname || /^\d+$/.test(nickname)) throw new HttpError(400, '请输入游戏昵称');
  const characters = input.characters || [];
  if (!Array.isArray(characters) || characters.length > 12) throw new HttpError(400, '角色池最多 12 个');
  const result = { nickname, alias: text(input.alias, 40), role, survivorPeak: text(input.survivorPeak, 80), hunterPeak: text(input.hunterPeak, 80), rank: '', intro: text(input.intro, 400), characters: characters.map(x => text(x, 40)), theme, featured };
  if (/(?:\d[\s-]*){11,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|身份证|手机号|学号|微信|真实姓名|联系电话|住址|(?:个人)?QQ\s*[:：]/i.test(JSON.stringify(result))) throw new HttpError(400, '公开主页中请勿填写私人联系方式，联系方式请填写到队内资料');
  return result;
}
function privateProfile(input) {
  const result = {};
  for (const [key, max] of [['realName',40],['contact',100],['college',80],['grade',40],['gameId',80],['availability',300],['notes',1000]]) result[key] = text(input[key], max);
  return result;
}

export async function handleAccount(request, env) {
  try {
    if (!env.DB) throw new HttpError(503, '账号服务尚未配置完成');
    const path = new URL(request.url).pathname.replace('/api/account/', '');
    const db = env.DB;
    if (request.method === 'GET') {
      if (path === 'profiles') {
        const rows = await stmt(db, 'SELECT u.player_id,p.public_json FROM account_profiles p JOIN account_users u ON u.id=p.user_id WHERE u.active=1 AND p.published=1').all();
        const claimed = await stmt(db, 'SELECT player_id FROM account_users').all();
        return json({ players: rows.results.map(p => ({ ...JSON.parse(p.public_json), id: p.player_id })), claimed: claimed.results.map(x => x.player_id) });
      }
      const user = await currentMember(request, env, path !== 'me');
      if (path === 'me') {
        if (!user) return json({ member: null });
        const profile = await stmt(db, 'SELECT public_json,private_json,published,consent FROM account_profiles WHERE user_id=?', user.id).first();
        return json({ member: user, profile: { ...JSON.parse(profile.public_json), id: user.player_id, published: Boolean(profile.published) }, privateProfile: { ...JSON.parse(profile.private_json), consent: Boolean(profile.consent) } });
      }
      if (path === 'directory') {
        admin(user);
        const rows = await stmt(db, 'SELECT u.player_id,p.public_json,p.private_json FROM account_profiles p JOIN account_users u ON u.id=p.user_id WHERE u.active=1 AND p.consent=1').all();
        await audit(db, user.id, 'read_directory', 'team');
        return json({ rows: rows.results.map(p => ({ id: p.player_id, nickname: JSON.parse(p.public_json).nickname, ...JSON.parse(p.private_json) })) });
      }
      if (path === 'audit') {
        admin(user, true);
        return json({ rows: (await stmt(db, 'SELECT a.id,u.username,a.action,a.target,a.created FROM account_audit a LEFT JOIN account_users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100').all()).results });
      }
      if (path === 'admin') {
        admin(user);
        return json({ members: (await stmt(db, 'SELECT id,username,role,active,player_id FROM account_users ORDER BY id').all()).results, invitations: (await stmt(db, 'SELECT hash,label,role,player_id,expires,used_by,revoked FROM account_invites ORDER BY created DESC LIMIT 100').all()).results });
      }
      throw new HttpError(404, '接口不存在');
    }
    if (request.method !== 'POST') throw new HttpError(405, '不支持此请求方式');
    sameOrigin(request);
    const body = await payload(request);
    if (['login', 'register'].includes(path)) {
      const name = username(body.username);
      const secret = password(body.password);
      await rate(db, 'ip:' + await digest(request.headers.get('CF-Connecting-IP') || 'unknown'), 40);
      await rate(db, 'username:' + name, 15);
      if (path === 'login') {
        const user = await stmt(db, 'SELECT * FROM account_users WHERE username=?', name).first();
        const computed = await passwordHash(secret, user?.salt || '00'.repeat(16), env.AUTH_PEPPER);
        if (!user || !equal(computed, user.password_hash) || !user.active) throw new HttpError(401, '用户名或密码不正确');
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(await session(env, user.id)) });
      }
      const code = text(body.code, 200);
      if (!code) throw new HttpError(400, '注册必须填写邀请码');
      if (await stmt(db, 'SELECT id FROM account_users WHERE username=?', name).first()) throw new HttpError(409, '用户名已被使用');
      const existingOwner = await stmt(db, 'SELECT id FROM account_users WHERE role=?', 'owner').first();
      const bootstrap = !existingOwner && env.ADMIN_SETUP_TOKEN && env.ADMIN_SETUP_TOKEN.length >= 32 && equal(await digest(code), await digest(env.ADMIN_SETUP_TOKEN));
      const codeHash = await digest(code);
      const invite = bootstrap ? null : await stmt(db, 'SELECT * FROM account_invites WHERE hash=? AND used_by IS NULL AND revoked=0 AND expires>?', codeHash, Date.now()).first();
      if (!bootstrap && !invite) throw new HttpError(400, '邀请码无效、已使用或已过期');
      const role = bootstrap ? 'owner' : invite.role;
      const salt = randomToken(16);
      const hashed = await passwordHash(secret, salt, env.AUTH_PEPPER);
      const claim = randomToken();
      let playerId = (!bootstrap && invite?.player_id) || 'p' + String(1000000 + (await stmt(db, 'SELECT coalesce(max(id),0)+1 AS next FROM account_users').first()).next);
      // The unique player_id guard and the conditional invitation claim make races fail closed.
      const existingProfile = legacyRoster.find(p => p.id === playerId); const profile = publicProfile({ ...existingProfile, nickname: text(body.nickname,32) || existingProfile?.nickname || name, role: existingProfile?.role || 'survivor' });
      const queries = [];
      if (!bootstrap) queries.push(stmt(db, 'UPDATE account_invites SET used_by=? WHERE hash=? AND used_by IS NULL AND revoked=0 AND expires>?', claim, codeHash, Date.now()));
      queries.push(bootstrap
        ? stmt(db, 'INSERT INTO account_users(username,password_hash,salt,role,player_id,created) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM account_users WHERE role=?)', name, hashed, salt, role, playerId, Date.now(), 'owner')
        : stmt(db, 'INSERT INTO account_users(username,password_hash,salt,role,player_id,created) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM account_invites WHERE hash=? AND used_by=?)', name, hashed, salt, role, playerId, Date.now(), codeHash, claim));
      queries.push(stmt(db, 'INSERT INTO account_profiles(user_id,public_json,private_json,published,consent) SELECT id,?,?,1,0 FROM account_users WHERE username=?', JSON.stringify(profile), '{}', name));
      try { await db.batch(queries); } catch (error) {
        if (String(error).includes('UNIQUE')) throw new HttpError(409, '注册发生冲突，请重试或联系管理员');
        throw error;
      }
      const user = await stmt(db, 'SELECT id FROM account_users WHERE username=?', name).first();
      if (!user) throw new HttpError(409, '邀请码已被使用，请联系管理员');
      await audit(db, user.id, 'register', role);
      return json({ ok: true }, 201, { 'Set-Cookie': sessionCookie(await session(env, user.id)) });
    }
    const user = await currentMember(request, env);
    if (path === 'logout') {
      await stmt(db, 'DELETE FROM account_sessions WHERE token_hash=?', await digest(readCookie(request))).run();
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }
    if (path === 'password') {
      await rate(db, 'password:' + user.id, 10);
      const credentials = await stmt(db, 'SELECT * FROM account_users WHERE id=?', user.id).first();
      if (!equal(await passwordHash(password(body.currentPassword), credentials.salt, env.AUTH_PEPPER), credentials.password_hash)) throw new HttpError(401, '当前密码不正确');
      const salt = randomToken(16), hashed = await passwordHash(password(body.newPassword), salt, env.AUTH_PEPPER);
      await db.batch([stmt(db, 'UPDATE account_users SET password_hash=?,salt=? WHERE id=?', hashed, salt, user.id), stmt(db, 'DELETE FROM account_sessions WHERE user_id=?', user.id)]);
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }
    if (path === 'profile') {
      const profile = publicProfile(body);
      await stmt(db, 'UPDATE account_profiles SET public_json=?,published=? WHERE user_id=?', JSON.stringify(profile), body.published === false ? 0 : 1, user.id).run();
      await audit(db, user.id, 'edit_profile', user.player_id);
      return json({ ok: true });
    }
    if (path === 'private') {
      const profile = privateProfile(body);
      if (body.consent !== true && Object.values(profile).some(Boolean)) throw new HttpError(400, '请确认资料可由管理员查看，或清空资料后撤回提交');
      await stmt(db, 'UPDATE account_profiles SET private_json=?,consent=? WHERE user_id=?', JSON.stringify(profile), body.consent === true ? 1 : 0, user.id).run();
      await audit(db, user.id, 'edit_private', user.player_id);
      return json({ ok: true });
    }
    admin(user);
    if (path === 'invite') {
      const role = text(body.role, 20) || 'player';
      if (!['admin','player'].includes(role)) throw new HttpError(400, '请选择队员或管理员权限');
      if (role === 'admin') admin(user, true);
      const playerId = text(body.playerId, 20) || null;
      if (playerId && !/^p[0-9]{4,8}$/.test(playerId)) throw new HttpError(400, '档案编号不正确');
      if (playerId && await stmt(db, 'SELECT id FROM account_users WHERE player_id=?', playerId).first()) throw new HttpError(409, '该档案已绑定账号');
      const code = 'HNUST-' + randomToken();
      const days = body.days === undefined ? 7 : Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new HttpError(400, '有效期须为 1–30 天');
      await stmt(db, 'INSERT INTO account_invites(hash,label,role,player_id,expires,created) VALUES(?,?,?,?,?,?)', await digest(code), text(body.label,80) || '入队邀请', role, playerId, Date.now() + days * 86400000, Date.now()).run();
      await audit(db, user.id, 'create_invite', role);
      return json({ code }, 201);
    }
    if (path === 'revoke') {
      const invitation = await stmt(db, 'SELECT role FROM account_invites WHERE hash=?', text(body.hash,64)).first();
      if (invitation?.role === 'admin') admin(user, true);
      await stmt(db, 'UPDATE account_invites SET revoked=1 WHERE hash=? AND used_by IS NULL', text(body.hash,64)).run();
      await audit(db, user.id, 'revoke_invite', 'invitation');
      return json({ ok: true });
    }
    if (path === 'member') {
      admin(user, true);
      if (!Number.isSafeInteger(body.id)) throw new HttpError(400, '成员编号不正确');
      const target = await stmt(db, 'SELECT id,role FROM account_users WHERE id=?', body.id).first();
      if (!target || target.role === 'owner') throw new HttpError(400, '不能修改队长账号');
      const role = text(body.role,20);
      if (!['admin','player'].includes(role)) throw new HttpError(400, '权限不正确');
      await db.batch([stmt(db, 'UPDATE account_users SET active=?,role=? WHERE id=?', body.active === true ? 1 : 0, role, body.id), stmt(db, 'DELETE FROM account_sessions WHERE user_id=?', body.id)]);
      await audit(db, user.id, 'update_member', body.id);
      return json({ ok: true });
    }
    throw new HttpError(404, '接口不存在');
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Account service operation failed'); // Never log submitted passwords, invitations or private data.
    return json({ error: '账号服务暂时不可用，请保留填写内容后重试' }, 503);
  }
}
