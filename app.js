(() => {
  'use strict';
  const base = new URL('./', document.currentScript.src);
  const nav = document.querySelector('#navigation');
  const toggle = document.querySelector('.menu-toggle');
  function closeMenu() { nav?.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false'); toggle?.setAttribute('aria-label', '打开菜单'); }
  toggle?.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单'); });
  nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('open')) { closeMenu(); toggle.focus(); } });
  document.addEventListener('click', e => { if (nav && !nav.contains(e.target) && !toggle?.contains(e.target)) closeMenu(); });
  window.matchMedia('(min-width:761px)').addEventListener('change', e => { if (e.matches) closeMenu(); });
  document.querySelectorAll('[data-year]').forEach(e => { e.textContent = new Date().getFullYear(); });
  const manorTabs = [...document.querySelectorAll('.manor-tabs [role="tab"]')];
  function selectManorTab(index, focus = false) {
    manorTabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) manorTabs[index].focus();
  }
  manorTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectManorTab(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % manorTabs.length;
      else if (event.key === 'ArrowLeft') next = (index + manorTabs.length - 1) % manorTabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = manorTabs.length - 1;
      else return;
      event.preventDefault();
      selectManorTab(next, true);
    });
  });
  document.querySelector('[data-copy-group]')?.addEventListener('click', async () => {
    const status = document.querySelector('[data-copy-status]');
    try { await navigator.clipboard.writeText('648418715'); status.textContent = '群号已复制，在 QQ 中搜索即可。'; }
    catch { status.textContent = '请长按复制群号：648418715'; }
  });
  const roleNames = { survivor: '求生者', hunter: '监管者', flex: '双阵营', support: '队员' };
  const fields = ['id', 'nickname', 'alias', 'role', 'characters', 'rank', 'survivorPeak', 'hunterPeak', 'intro'];
  const suspicious = /(?:\d[\s-]*){11,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|身份证|手机号|学号|微信|真实姓名|联系电话|住址|(?:个人)?QQ\s*[:：]/i;
  function isPublic(p) { return p && Object.keys(p).every(k => fields.includes(k)) && /^p[0-9]{4,8}$/.test(p.id) && typeof p.nickname === 'string' && p.nickname.length > 0 && p.nickname.length <= 32 && !/^\d+$/.test(p.nickname) && Object.hasOwn(roleNames, p.role) && Array.isArray(p.characters) && p.characters.every(c => typeof c === 'string' && c.length <= 40) && ['alias', 'rank', 'survivorPeak', 'hunterPeak', 'intro'].every(k => p[k] === undefined || typeof p[k] === 'string') && !suspicious.test(JSON.stringify(p)); }
  const players = (Array.isArray(window.HNUST_ROSTER) ? window.HNUST_ROSTER : []).filter(isPublic);
  const link = path => new URL(path, base).href;
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function card(p) {
    const index = players.findIndex(x => x.id === p.id);
    const a = el('a', 'member-card'); a.href = link('players/' + p.id + '/'); a.dataset.role = p.role;
    const art = el('div', 'member-card-visual'); art.setAttribute('aria-hidden', 'true');
    art.append(el('span', 'role-label', roleNames[p.role]), el('span', 'initial', Array.from(p.alias || p.nickname)[0]), el('span', 'card-index', String(index + 1).padStart(2, '0')));
    const content = el('div', 'member-card-content'); content.append(el('h3', '', p.nickname), el('p', 'member-alias', p.alias ? '队内网名 / ' + p.alias : roleNames[p.role]));
    const rank = el('p', 'card-rank'); rank.append(el('span', '', (p.role === 'hunter' ? '监管者' : '求生者') + ' · 历史最高'), document.createTextNode((p.role === 'hunter' ? p.hunterPeak : p.survivorPeak) || p.rank || '暂未公开')); content.append(rank);
    const end = el('span', 'card-link'); end.append(el('span', '', '查看游戏档案'), el('span', '', '↗')); content.append(end); a.append(art, content); return a;
  }
  const home = document.querySelector('[data-roster-home]');
  if (home) { home.replaceChildren(); ['p0001', 'p0002', 'p0006', 'p0008'].map(id => players.find(p => p.id === id)).filter(Boolean).forEach(p => home.append(card(p))); }
  const directory = document.querySelector('[data-roster-directory]');
  let role = new URLSearchParams(location.search).get('role') || 'all'; if (!['all', 'survivor', 'hunter', 'flex'].includes(role)) role = 'all';
  const search = document.querySelector('#member-search'), buttons = document.querySelectorAll('[data-role-filter]');
  function renderDirectory() {
    if (!directory) return;
    const q = (search?.value || '').trim().toLocaleLowerCase();
    const selected = players.filter(p => (role === 'all' || p.role === role) && [p.nickname, p.alias, ...p.characters].join(' ').toLocaleLowerCase().includes(q));
    directory.replaceChildren(); selected.forEach(p => directory.append(card(p)));
    if (!selected.length) { const box = el('div', 'roster-empty'); box.append(el('h2', '', '没有匹配的档案'), el('p', '', '换一个游戏昵称、队内网名，或切换为全部阵营。')); directory.append(box); }
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roleFilter === role)));
    const count = document.querySelector('[data-roster-count]'); if (count) count.textContent = '显示 ' + selected.length + ' / ' + players.length + ' 份队员档案';
  }
  buttons.forEach(b => b.addEventListener('click', () => { role = b.dataset.roleFilter; const url = new URL(location.href); if (role === 'all') url.searchParams.delete('role'); else url.searchParams.set('role', role); history.replaceState(null, '', url); renderDirectory(); }));
  search?.addEventListener('input', renderDirectory); renderDirectory();
  const detail = document.querySelector('[data-player-detail]');
  if (detail) {
    const id = document.body.dataset.playerId || new URLSearchParams(location.search).get('id');
    const p = players.find(p => p.id === id);
    if (p) {
      detail.replaceChildren(); document.title = p.nickname + ' · 队员档案 · HNUST 第五人格校队';
      const index = players.findIndex(x => x.id === p.id), top = el('div', 'player-top'), visual = el('div', 'player-visual'); visual.dataset.role = p.role; visual.setAttribute('aria-hidden', 'true');
      visual.append(el('span', 'player-initial', Array.from(p.alias || p.nickname)[0]), el('span', 'player-tag', 'HNUST / IDENTITY V'), el('span', 'player-number', String(index + 1).padStart(2, '0')));
      const intro = el('div', 'player-intro'); intro.append(el('p', 'player-role', roleNames[p.role] + ' / PLAYER PROFILE'), el('h1', '', p.nickname)); if (p.alias) intro.append(el('p', 'player-alias', '队内网名 / ' + p.alias));
      const ranks = el('div', 'profile-ranks'); [['求生者 · 历史最高', p.survivorPeak], ['监管者 · 历史最高', p.hunterPeak]].forEach(([label, value]) => { const item = el('div'); item.append(el('small', '', label), el('strong', '', value || '暂未公开')); ranks.append(item); }); intro.append(ranks, el('p', 'historical-note', '历史段位按队员提供的资料展示，不代表当前赛季段位。')); if (p.intro) intro.append(el('p', '', p.intro)); top.append(visual, intro);
      const bottom = el('div', 'player-bottom'), info = el('div'); info.append(el('p', 'eyebrow', 'GAME IDENTITY / 游戏资料'), el('h2', '', '在庄园里相识。'), el('p', '', '主玩阵营：' + roleNames[p.role] + '。' + (p.role === 'flex' ? '在求生者与监管者之间切换，探索不同的对局视角。' : p.role === 'hunter' ? '以监管者视角，与队伍一起交流对局思路。' : '以求生者视角，与队友一起寻找配合。')));
      if (p.characters.length) { const chars = el('div', 'character-tags'); p.characters.forEach(c => chars.append(el('span', '', c))); info.append(chars); }
      const join = el('div'); join.append(el('p', 'eyebrow', 'PLAY TOGETHER / 一起上场'), el('h2', '', '下一局，遇见队友。'), el('p', '', '找游戏搭子、聊比赛，也关注校队的选拔与活动安排。')); const cta = el('a', 'button outline', '加入湖科大第五人格社群 ↗'); cta.href = link('join.html#community'); join.append(cta); bottom.append(info, join); detail.append(top, bottom);
      const related = el('section', 'profile-related'); related.append(el('h2', '', '继续认识队友。')); const grid = el('div', 'member-grid'); [1, 2, 3].forEach(offset => grid.append(card(players[(index + offset) % players.length]))); related.append(grid); detail.append(related);
    } else if (id) { detail.replaceChildren(); const box = el('div', 'roster-empty'); box.append(el('h2', '', '这份档案暂未公开'), el('p', '', '返回队员目录查看公开档案。')); detail.append(box); }
  }
})();
