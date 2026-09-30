(() => {
  'use strict';
  const script = document.currentScript;
  const base = new URL('./', script.src);
  const nav = document.querySelector('#navigation');
  const toggle = document.querySelector('.menu-toggle');
  function closeMenu(){nav?.classList.remove('open');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','打开菜单');}
  toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'关闭菜单':'打开菜单');});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('open')){closeMenu();toggle.focus();}});
  document.addEventListener('click',e=>{if(nav&&!nav.contains(e.target)&&!toggle.contains(e.target))closeMenu();});
  window.matchMedia('(min-width:761px)').addEventListener?.('change',e=>{if(e.matches)closeMenu();});
  document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());

  document.querySelectorAll('img[data-asset]').forEach(img=>{
    const name=img.dataset.asset;let attempt=0;
    const paths=['assets/'+name+'.jpg','assets/'+name+'.png','assets/'+name+'.webp'];
    const slot=img.closest('[data-image-slot]'), fallback=slot?.querySelector('[hidden]');
    function loaded(){if(fallback)fallback.hidden=true;img.hidden=false;const a=slot?.querySelector('[data-qr-original]');if(a){a.href=img.src;a.hidden=false;}}
    function failed(){attempt+=1;if(attempt<paths.length){img.src=new URL(paths[attempt],base).href;return;}img.hidden=true;if(fallback)fallback.hidden=false;}
    img.addEventListener('load',loaded);img.addEventListener('error',failed);
    if(img.complete){if(img.naturalWidth===0)failed();else loaded();}
  });

  document.querySelector('[data-copy-group]')?.addEventListener('click',async()=>{
    const status=document.querySelector('[data-copy-status]');
    try{if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText('648418715');status.textContent='群号已复制，在 QQ 中搜索即可。';}
    catch{status.textContent='请长按复制群号：648418715';}
  });

  const roleNames={survivor:'求生者',hunter:'监管者',flex:'双阵营',support:'队员'};
  const roster=Array.isArray(window.HNUST_ROSTER)?window.HNUST_ROSTER:[];
  const publicFields=['id','nickname','role','characters','rank','intro'];
  const suspicious=/(?:\d[\s-]*){11,}|身份证|手机号|学号|微信|真实姓名|联系电话|住址|(?:个人)?QQ\s*[:：]|(?:身份证|手机号|电话)\s*[:：]/i;
  function isPublicRecord(p){return p&&Object.keys(p).every(k=>publicFields.includes(k))&&/^p[0-9]{4,8}$/.test(p.id)&&typeof p.nickname==='string'&&p.nickname.length>0&&p.nickname.length<=32&&['survivor','hunter','flex','support'].includes(p.role)&&Array.isArray(p.characters)&&p.characters.every(c=>typeof c==='string'&&c.length<=40)&&['rank','intro'].every(k=>p[k]===undefined||typeof p[k]==='string')&&!suspicious.test(JSON.stringify(p));}
  const players=roster.filter(isPublicRecord);
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
  function card(p,index){const a=el('a','member-card');a.href=new URL('players/'+p.id+'/',base).href;a.dataset.role=p.role;const art=el('div','member-card-visual');art.setAttribute('aria-hidden','true');art.append(el('span','role-label',roleNames[p.role]),el('span','initial',Array.from(p.nickname)[0]),el('span','card-index',String(index+1).padStart(2,'0')));const content=el('div','member-card-content');content.append(el('h3','',p.nickname),el('p','',p.characters.length?p.characters.join(' / '):roleNames[p.role]));const end=el('span','card-link');end.append(el('span','','选手档案'),el('span','','↗'));content.append(end);a.append(art,content);return a;}
  function empty(container,filtered){const box=el('div','roster-empty');const inner=el('div');inner.append(el('h2','',filtered?'没有匹配的档案':'队员档案正在整理'),el('p','',filtered?'换一个游戏昵称或角色试试，或切换为全部阵营。':'公开资料确认后，队员的游戏昵称、阵营与角色池将在这里亮相。'));box.append(el('span','empty-mark','HNUST'),inner);container.append(box);}
  const home=document.querySelector('[data-roster-home]');if(home&&players.length){home.replaceChildren();players.slice(0,3).forEach((p,i)=>home.append(card(p,i)));}
  const directory=document.querySelector('[data-roster-directory]');let role=new URLSearchParams(location.search).get('role')||'all';if(!['all','survivor','hunter','flex'].includes(role))role='all';
  const search=document.querySelector('#member-search'), buttons=document.querySelectorAll('[data-role-filter]');
  function renderDirectory(){if(!directory)return;const q=(search?.value||'').trim().toLocaleLowerCase();const selected=players.filter(p=>(role==='all'||p.role===role||(p.role==='flex'&&(role==='survivor'||role==='hunter')))&&[p.nickname,...p.characters].join(' ').toLocaleLowerCase().includes(q));directory.replaceChildren();selected.forEach((p,i)=>directory.append(card(p,i)));if(!selected.length)empty(directory,players.length>0);buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roleFilter===role)));const count=document.querySelector('[data-roster-count]');if(count)count.textContent=players.length?'共 '+selected.length+' 位公开队员':'队员档案整理中';}
  buttons.forEach(b=>b.addEventListener('click',()=>{role=b.dataset.roleFilter;renderDirectory();}));
  search?.addEventListener('input',renderDirectory);renderDirectory();

  const detail=document.querySelector('[data-player-detail]');
  if(detail){
    const id=document.body.dataset.playerId||new URLSearchParams(location.search).get('id');
    const p=players.find(p=>p.id===id);
    if(p){
      detail.replaceChildren();document.title=p.nickname+' · 队员档案 · HNUST 第五人格校队';
      const top=el('div','player-top'),visual=el('div','player-visual');visual.dataset.role=p.role;visual.setAttribute('aria-hidden','true');visual.append(el('span','player-initial',Array.from(p.nickname)[0]),el('span','player-tag','HNUST / '+p.role.toUpperCase()));
      const intro=el('div','player-intro');intro.append(el('p','player-role',roleNames[p.role]+' / PLAYER PROFILE'),el('h1','',p.nickname),el('p','',p.intro||'用自己的方式，与队伍共同上场。'));
      const meta=el('div','player-meta');[['阵营',roleNames[p.role]],['游戏段位',p.rank||'暂未公开']].forEach(([k,v])=>{const n=el('div');n.append(el('small','',k),el('strong','',v));meta.append(n);});intro.append(meta);top.append(visual,intro);
      const bottom=el('div','player-bottom'),chars=el('div');chars.append(el('h2','','擅长角色'));const tags=el('div','character-tags');if(p.characters.length)p.characters.forEach(c=>tags.append(el('span','',c)));else tags.append(el('p','','角色池暂未公开'));chars.append(tags);const info=el('div');info.append(el('h2','','一起上场'),el('p','','在社群找到游戏搭子，关注校队的选拔与活动安排。'));const join=el('a','button outline','加入湖科大第五人格社群');join.href=new URL('join.html#community',base).href;info.append(join);bottom.append(chars,info);detail.append(top,bottom);
      const other=players.filter(x=>x.id!==p.id).slice(0,3);if(other.length){const related=el('section','profile-related');related.append(el('h2','','还有这些队友'));const grid=el('div','member-grid');other.forEach((x,i)=>grid.append(card(x,i)));related.append(grid);detail.append(related);}
    }else if(id){detail.replaceChildren();const box=el('div','roster-empty');const text=el('div');text.append(el('h1','','这份档案暂未公开'),el('p','','返回队员列表，查看目前公开的档案。'));const back=el('a','button primary','查看队员列表');back.href=new URL('roster.html',base).href;text.append(back);box.append(text);detail.append(box);document.title='档案暂未公开 · HNUST 第五人格校队';}
  }
})();
