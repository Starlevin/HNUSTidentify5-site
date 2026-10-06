
(() => {
'use strict';
const $ = id => document.getElementById(id);
let registering = false, me = null, working = false, inviteCode = '';
const apiBase = new URL('./', document.currentScript.src);
async function api(path, data) {
  const response = await fetch(new URL('api/account/' + path, apiBase), { method: data === undefined ? 'GET' : 'POST', headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), credentials: 'same-origin' });
  if (!(response.headers.get('Content-Type') || '').includes('application/json')) throw Error('此地址的账号服务尚未接入，暂时不能注册或登录。');
  const result = await response.json(); if (!response.ok) throw Error(result.error || '暂时无法完成，请稍后重试'); return result;
}
function status(message) { $('account-status').textContent = message; }
async function act(operation) {
  if (working) return; working = true;
  document.querySelectorAll('.account-shell button').forEach(button => { button.disabled = true; });
  try { await operation(); } catch (error) { status(error.message); }
  finally { working = false; document.querySelectorAll('.account-shell button').forEach(button => { button.disabled = false; }); }
}
function values(form) { return Object.fromEntries(new FormData(form)); }
function populate(form, values) {
  for (const [key, value] of Object.entries(values || {})) {
    const field = form.elements.namedItem(key); if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = Array.isArray(value) ? value.join('、') : value ?? '';
  }
}
function el(tag, value = '', className = '') { const element = document.createElement(tag); element.textContent = value; element.className = className; return element; }
function setMode(mode) {
  registering = mode;
  $('register-fields').hidden = !mode;
  $('login-tab').setAttribute('aria-pressed', String(!mode));
  $('register-tab').setAttribute('aria-pressed', String(mode));
  $('auth-submit').textContent = mode ? '注册并登录' : '登录';
  const form = $('auth-form');
  form.elements.password.autocomplete = mode ? 'new-password' : 'current-password';
  form.elements.confirmPassword.required = mode;
  form.elements.code.required = mode;
  form.elements.nickname.required = mode;
}
async function refresh() {
  me = await api('me');
  $('auth-panel').hidden = Boolean(me.member); $('member-panel').hidden = !me.member;
  if (me.member) {
    $('member-heading').textContent = (me.profile.nickname || me.member.username) + ' · ' + ({ owner: '队长 / 超级管理员', admin: '管理员', player: '队员' }[me.member.role]);
    $('profile-form').reset(); $('private-form').reset(); populate($('profile-form'), me.profile); populate($('private-form'), me.privateProfile);
    $('my-profile').href = new URL('player.html?id=' + encodeURIComponent(me.member.player_id), apiBase).href;
    $('admin-tab').hidden = !['owner', 'admin'].includes(me.member.role);
    $('invite-admin-option').hidden = me.member.role !== 'owner';
    $('invite-admin-option').disabled = me.member.role !== 'owner';
    status('已登录。公开主页与队内资料分别保存。');
  } else status('使用校队自己的用户名和密码登录。首次注册需要邀请码。');
}
async function showPanel(id) {
  ['profile-panel','private-panel','directory-panel','password-panel','admin-panel'].forEach(name => { $(name).hidden = name !== id; });
  document.querySelectorAll('#member-tabs button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.panel === id)));
  if (id === 'directory-panel') {
    const data = await api('directory'); const target = $('directory-list'); target.replaceChildren();
    if (!data.rows.length) target.append(el('p', '暂时没有队员提交共享资料。'));
    for (const row of data.rows) {
      const card = el('article', '', 'account-card'); card.append(el('h3', row.nickname)); const list = el('dl');
      for (const [key, label] of [['realName','姓名'],['contact','联系方式'],['college','学院 / 专业'],['grade','年级'],['gameId','游戏 ID'],['availability','训练时间'],['notes','队内备注']]) {
        const item = el('div'); item.append(el('dt', label), el('dd', row[key] || '未填写')); list.append(item);
      } card.append(list); target.append(card);
    }
  }
  if (id === 'admin-panel') await renderAdmin();
}
async function renderAdmin() {
  const data = await api('admin');
  const select = $('invite-player'); select.replaceChildren(el('option', '新建队员档案')); select.options[0].value = '';
  for (const p of window.HNUST_ROSTER || []) if (!data.members.some(m => m.player_id === p.id)) { const option = el('option', p.nickname + ' / ' + (p.alias || p.id)); option.value = p.id; select.append(option); }
  $('admin-members').replaceChildren();
  for (const m of data.members) {
    const row = el('div', '', 'account-management-row'); row.append(el('span', m.username + ' · ' + ({owner:'队长',admin:'管理员',player:'队员'}[m.role]) + ' · ' + (m.active ? '有效' : '已停用')));
    if (me.member.role === 'owner' && m.role !== 'owner') {
      const disable = el('button', m.active ? '停用' : '启用'); disable.type = 'button';
      disable.addEventListener('click', () => { if (confirm('确认更改 ' + m.username + ' 的账号状态？')) act(async () => { await api('member', {id:m.id,role:m.role,active:!m.active}); await renderAdmin(); status('账号状态已更新。'); }); });
      const role = el('button', m.role === 'admin' ? '设为队员' : '设为管理员'); role.type = 'button';
      role.addEventListener('click', () => { if (confirm('确认更改 ' + m.username + ' 的管理员权限？')) act(async () => { await api('member',{id:m.id,active:Boolean(m.active),role:m.role==='admin'?'player':'admin'}); await renderAdmin(); status('权限已更新。'); }); });
      row.append(disable, role);
    } $('admin-members').append(row);
  }
  $('admin-invites').replaceChildren();
  for (const i of data.invitations) {
    const row = el('div', '', 'account-management-row'); row.append(el('span', i.label + ' · ' + (i.role==='admin'?'管理员':'队员') + ' · ' + (i.used_by?'已使用':i.revoked?'已撤销':i.expires<Date.now()?'已过期':'待使用')));
    if (!i.used_by && !i.revoked) { const revoke = el('button','撤销'); revoke.type='button'; revoke.addEventListener('click',()=>act(async()=>{await api('revoke',{hash:i.hash});await renderAdmin();status('邀请码已撤销。');}));row.append(revoke); }
    $('admin-invites').append(row);
  }
}
$('login-tab').addEventListener('click', () => setMode(false)); $('register-tab').addEventListener('click', () => setMode(true));
$('auth-form').addEventListener('submit', event => { event.preventDefault(); const form=event.currentTarget; act(async () => {
  const body = values(form); if (registering && body.password !== body.confirmPassword) throw Error('两次输入的密码不一致');
  await api(registering ? 'register' : 'login', body); form.reset(); await refresh(); await showPanel('profile-panel');
}); });
$('logout').addEventListener('click', () => act(async () => { await api('logout', {}); $('directory-list').replaceChildren(); $('admin-members').replaceChildren(); $('admin-invites').replaceChildren(); $('invite-result').hidden=true;inviteCode='';$('invite-code').textContent='';await refresh();status('已退出登录。'); }));
$('profile-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget;act(async () => {
  const data = values(form); data.characters=(data.characters||'').split(/[、,，]/).map(x=>x.trim()).filter(Boolean);data.published=form.elements.published.checked;
  await api('profile',data);await refresh();status('选手主页已保存。');
}); });
$('private-form').addEventListener('submit', event => { event.preventDefault(); const form=event.currentTarget;act(async()=>{
  const data=values(form);data.consent=form.elements.consent.checked;await api('private',data);await refresh();status('队内资料已保存。');
}); });
$('password-form').addEventListener('submit', event=>{event.preventDefault();const form=event.currentTarget;act(async()=>{
  const data=values(form);if(data.newPassword!==data.confirmPassword)throw Error('两次输入的新密码不一致');await api('password',data);form.reset();$('directory-list').replaceChildren();await refresh();status('密码已修改，所有设备已退出，请重新登录。');
}); });
$('invite-form').addEventListener('submit', event=>{event.preventDefault();const form=event.currentTarget;act(async()=>{
  const data=await api('invite',values(form));inviteCode=data.code;$('invite-code').textContent=inviteCode;$('invite-result').hidden=false;await renderAdmin();status('邀请码已生成，请保存。');
}); });
$('copy-invite').addEventListener('click',()=>act(async()=>{try{await navigator.clipboard.writeText(inviteCode);status('邀请码已复制。');}catch{status('请手动复制上方邀请码。');}}));
document.querySelectorAll('#member-tabs button').forEach(button=>button.addEventListener('click',()=>act(()=>showPanel(button.dataset.panel))));
setMode(false);refresh().catch(error=>{status(error.message);$('auth-panel').hidden=true;});
})();
