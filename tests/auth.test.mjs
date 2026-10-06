
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { digest, sessionCookie, COOKIE } from '../worker/credentials.mjs';

test('independent accounts enforce invitations, sessions, ownership and member permissions', async () => {
  const mf=new Miniflare({
    scriptPath:new URL('../worker/index.mjs',import.meta.url).pathname,
    modules:true,modulesRules:[{type:'ESModule',include:['**/*.mjs']}],
    compatibilityDate:'2026-05-15',
    d1Databases:['DB'],
    bindings:{AUTH_PEPPER:'test-only-pepper-012345678901234567890123456789',ADMIN_SETUP_TOKEN:'test-only-bootstrap-012345678901234567890123456789'}
  });
  try {
    const db=await mf.getD1Database('DB');
    for(const sql of (await readFile(new URL('../migrations/0001_independent_accounts.sql',import.meta.url),'utf8')).split(';'))if(sql.trim())await db.prepare(sql).run();
    const pw='a-secret-password-2026',cookies={};
    async function request(path,body,cookie='',origin='https://team.test'){
      const headers={};if(cookie)headers.Cookie=cookie;
      if(body!==undefined){headers.Origin=origin;headers['Content-Type']='application/json'}
      const r=await mf.dispatchFetch('https://team.test/api/account/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
      const data=await r.json();const set=r.headers.get('Set-Cookie');
      return {status:r.status,data,cookie:set?set.split(';')[0]:'',set};
    }
    assert.equal((await request('me')).data.member,null);
    assert.equal((await request('directory')).status,401);
    assert.equal((await request('register',{username:'outsider',password:pw,nickname:'未受邀玩家',code:'fake'})).status,400);
    assert.equal((await request('register',{username:'outsider',password:pw,nickname:'未受邀玩家'})).status,400);
    let result=await request('register',{username:'captain',password:pw,nickname:'队长',code:'test-only-bootstrap-012345678901234567890123456789'});
    assert.equal(result.status,201);cookies.owner=result.cookie;
    assert.match(result.set,/HttpOnly/);assert.match(result.set,/Secure/);assert.match(result.set,/SameSite=Strict/);assert.match(result.cookie,/^__Host-/);
    const owner=(await request('me',undefined,cookies.owner)).data.member;
    assert.equal(owner.role,'owner');assert.equal(owner.player_id,'p1000001');
    const raw=await db.prepare('SELECT * FROM account_users WHERE id=?').bind(owner.id).first();
    assert.notEqual(raw.password_hash,pw);assert.equal(raw.salt.length,32);
    assert.equal((await request('register',{username:'second_owner',password:pw,nickname:'第二队长',code:'test-only-bootstrap-012345678901234567890123456789'})).status,400);
    assert.equal((await request('login',{username:'captain',password:'wrong-password-2026'})).status,401);
    assert.equal((await request('login',{username:'nobody_here',password:pw})).status,401);
    const invitation=await request('invite',{role:'player',label:'Alice',playerId:'p0002'},cookies.owner);
    assert.equal(invitation.status,201);
    result=await request('register',{username:'alice',password:pw,nickname:'Alice',code:invitation.data.code});
    assert.equal(result.status,201);cookies.alice=result.cookie;
    const alice=(await request('me',undefined,cookies.alice)).data.member;
    assert.equal(alice.role,'player');assert.equal(alice.player_id,'p0002');
    assert.equal((await request('register',{username:'stolen_invite',password:pw,nickname:'Bob',code:invitation.data.code})).status,400);
    assert.equal((await request('admin',undefined,cookies.alice)).status,403);
    assert.equal((await request('invite',{role:'admin'},cookies.alice)).status,403);
    assert.equal((await request('profile',{user_id:owner.id,nickname:'Alice Edited',role:'survivor',characters:['佣兵'],theme:'blue',featured:'mercenary',published:true},cookies.alice)).status,200);
    assert.equal((await request('me',undefined,cookies.owner)).data.profile.nickname,'队长');
    assert.equal((await request('private',{user_id:owner.id,realName:'Alice Secret',contact:'private-contact',consent:true},cookies.alice)).status,200);
    const publicData=(await request('profiles')).data;assert.ok(!JSON.stringify(publicData).includes('private-contact'));assert.ok(!JSON.stringify(publicData).includes('password_hash'));
    assert.equal((await request('directory',undefined,cookies.owner)).data.rows[0].contact,'private-contact');
    assert.equal((await request('directory',undefined,cookies.alice)).status,403);
    assert.equal((await request('private',{realName:'CSRF',consent:true},cookies.alice,'https://evil.test')).status,403);
    assert.equal((await request('private',{realName:'No consent',consent:false},cookies.alice)).status,400);
    assert.equal((await request('private',{consent:false},cookies.alice)).status,200);
    assert.equal((await request('directory',undefined,cookies.owner)).data.rows.length,0);
    assert.equal((await request('me',undefined,COOKIE+'=forged')).data.member,null);
    const revoke=await request('invite',{role:'player'},cookies.owner);
    assert.equal((await request('revoke',{hash:await digest(revoke.data.code)},cookies.owner)).status,200);
    assert.equal((await request('register',{username:'revoked',password:pw,nickname:'撤销邀请',code:revoke.data.code})).status,400);
    const expired=await request('invite',{role:'player'},cookies.owner);
    await db.prepare('UPDATE account_invites SET expires=0 WHERE hash=?').bind(await digest(expired.data.code)).run();
    assert.equal((await request('register',{username:'expired',password:pw,nickname:'过期邀请',code:expired.data.code})).status,400);
    const adminInvite=await request('invite',{role:'admin'},cookies.owner);
    result=await request('register',{username:'manager',password:pw,nickname:'管理员',code:adminInvite.data.code});assert.equal(result.status,201);cookies.admin=result.cookie;
    assert.equal((await request('admin',undefined,cookies.admin)).status,200);
    assert.equal((await request('invite',{role:'admin'},cookies.admin)).status,403);
    assert.equal((await request('member',{id:owner.id,active:false,role:'player'},cookies.owner)).status,400);
    assert.equal((await request('member',{id:alice.id,active:false,role:'player'},cookies.owner)).status,200);
    assert.equal((await request('directory',undefined,cookies.alice)).status,401);
    assert.equal((await request('login',{username:'alice',password:pw})).status,401);
    assert.ok(!(await request('profiles')).data.players.some(p=>p.id===alice.player_id));
    assert.equal((await request('member',{id:alice.id,active:true,role:'player'},cookies.owner)).status,200);
    result=await request('login',{username:'ALICE',password:pw});assert.equal(result.status,200);cookies.alice=result.cookie;
    const another=await request('login',{username:'alice',password:pw});
    assert.equal((await request('password',{currentPassword:pw,newPassword:'a-new-secret-password-2026'},cookies.alice)).status,200);
    assert.equal((await request('me',undefined,another.cookie)).data.member,null);
    assert.equal((await request('login',{username:'alice',password:pw})).status,401);
    result=await request('login',{username:'alice',password:'a-new-secret-password-2026'});assert.equal(result.status,200);cookies.alice=result.cookie;
    assert.equal((await request('logout',{},cookies.alice)).status,200);
    assert.equal((await request('me',undefined,cookies.alice)).data.member,null);
    assert.equal((await request('login',{username:'limited',password:pw})).status,401);
    await db.prepare('INSERT OR REPLACE INTO account_attempts(key,window,count) VALUES(?,?,?)').bind('username:limited',Math.floor(Date.now()/900000),15).run();
    assert.equal((await request('login',{username:'limited',password:pw})).status,429);
    assert.equal((await request('register',{username:'shortpw',password:'short',code:'x'})).status,400);
    assert.match(sessionCookie('',0),/Max-Age=0/);
  } finally { await mf.dispose(); }
});
