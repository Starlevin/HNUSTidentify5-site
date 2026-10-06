(() => {
'use strict';
const $=id=>document.getElementById(id), base=new URL('./',document.currentScript.src);
let internal=false, canManage=false, records=[], players=window.HNUST_ROSTER||[], busy=false;
const kinds={official:'正式比赛',scrim:'训练赛',campus:'校内赛',friendly:'友谊赛'};
function el(tag,text='',cls=''){const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;}
async function api(path,body){const r=await fetch(new URL('api/matches/'+path,base),{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!(r.headers.get('Content-Type')||'').includes('application/json'))throw Error('此地址尚未接入比赛服务。');const data=await r.json();if(!r.ok)throw Error(data.error||'请求未完成');return data;}
async function act(fn){if(busy)return;busy=true;try{await fn();}catch(e){$('match-status').textContent=e.message;}finally{busy=false;}}
function name(id){return players.find(p=>p.id===id)?.nickname||id;}
function label(title,input){const n=el('label',title);n.append(input);return n;}
function input(name,value='',type='text'){const n=el('input');n.name=name;n.type=type;n.value=value;n.required=true;return n;}
function select(name,options,value){const n=el('select');n.name=name;for(const [v,t]of options){const o=el('option',t);o.value=v;n.append(o);}if(value!==undefined)n.value=value;return n;}
function addRound(r={}){
 const box=el('fieldset','','account-card round-input'),legend=el('legend','半场记录');box.append(legend);
 const grid=el('div','','account-fields');const number=input('number',r.round_number||1,'number');number.min=1;number.max=10;
 const side=select('side',[['survivor','求生者'],['hunter','监管者']],r.side||'survivor');
 const map=input('map',r.map||'');map.maxLength=40;
 const score=select('score',[['5:0','5 : 0'],['3:1','3 : 1'],['2:2','2 : 2'],['1:3','1 : 3'],['0:5','0 : 5']],r.team_score===undefined?'2:2':r.team_score+':'+r.opponent_score);
 grid.append(label('第几局',number),label('我方阵营',side),label('地图',map),label('半场积分（我方 : 对方）',score));box.append(grid);
 const picks=el('div','','round-picks');
 function renderPicks(saved=[]){picks.replaceChildren();for(let i=0;i<(side.value==='survivor'?4:1);i++){const row=el('div','','account-fields');const person=select('playerId',[['','请选择队员'],...players.map(p=>[p.id,p.nickname])],saved[i]?.player_id||'');person.required=true;const character=input('character',saved[i]?.character||'');character.maxLength=40;row.append(label('选手 '+(i+1),person),label('使用角色',character));picks.append(row);}}
 side.addEventListener('change',()=>renderPicks());renderPicks(r.picks);box.append(picks);
 const bans=input('bans',(r.bans||[]).join('、'));bans.required=false;bans.maxLength=500;box.append(label('Ban 角色（顿号分隔，可留空）',bans));
 const remove=el('button','移除半场','button outline');remove.type='button';remove.addEventListener('click',()=>box.remove());box.append(remove);$('round-editor').append(box);
}
function editor(m){const f=$('match-form');f.reset();f.elements.id.value=m?.id||'';f.elements.title.value=m?.title||'';f.elements.opponent.value=m?.opponent||'';f.elements.playedOn.value=m?.played_on||new Date().toLocaleDateString('en-CA');f.elements.kind.value=m?.kind||'official';f.elements.published.checked=Boolean(m?.published);$('round-editor').replaceChildren();(m?.rounds||[{}]).forEach(addRound);$('match-editor').hidden=false;f.elements.title.focus();}
function render(){
 const target=$('match-list');target.replaceChildren();let halfWins=0,halves=0,total=0,against=0;
 for(const m of records){const card=el('article','','account-card');card.append(el('p',m.played_on+' · '+kinds[m.kind]+' · '+(m.published?'公开':'队内'),'eyebrow'),el('h2',m.title),el('h3','HNUST vs '+m.opponent));let a=0,b=0;
 for(const r of m.rounds){a+=r.team_score;b+=r.opponent_score;total+=r.team_score;against+=r.opponent_score;halves++;if(r.team_score>r.opponent_score)halfWins++;card.append(el('p','第 '+r.round_number+' 局 · '+r.map+' · '+(r.side==='survivor'?'求生者':'监管者')+' · '+r.team_score+' : '+r.opponent_score));card.append(el('p',r.picks.map(p=>name(p.player_id)+' / '+p.character).join(' · '),'account-note'));if(r.bans.length)card.append(el('p','Ban：'+r.bans.join('、'),'account-note'));}
 card.append(el('p','已录入半场总积分 '+a+' : '+b+'（不代替赛事大局结果）','account-note'));
 if(canManage&&internal){const edit=el('button','编辑','button outline');edit.type='button';edit.addEventListener('click',()=>editor(m));const del=el('button','删除','button outline');del.type='button';del.addEventListener('click',()=>{if(confirm('删除这场比赛及其半场记录？'))act(async()=>{await api('delete',{id:m.id});await refresh();});});card.append(edit,del);}target.append(card);}
 if(!records.length)target.append(el('p','暂无比赛记录。管理员录入并发布后会显示在这里。','account-card'));
 $('match-summary').replaceChildren(el('span',records.length+' 场记录'),el('span',halves+' 个半场'),el('span',halves?'半场胜率 '+Math.round(halfWins/halves*100)+'%':'半场胜率 —'),el('span','总积分 '+total+' : '+against));
}
async function refresh(){const data=await api(internal?'list':'public');records=data.matches;render();$('match-status').textContent=internal?'显示队内比赛和训练赛记录。':'显示管理员已公开发布的比赛。';$('public-matches').setAttribute('aria-pressed',String(!internal));$('internal-matches').setAttribute('aria-pressed',String(internal));}
$('public-matches').addEventListener('click',()=>act(async()=>{internal=false;await refresh();}));$('internal-matches').addEventListener('click',()=>act(async()=>{internal=true;await refresh();}));$('new-match').addEventListener('click',()=>editor());$('add-round').addEventListener('click',()=>addRound());$('cancel-match').addEventListener('click',()=>{$('match-editor').hidden=true;});
$('match-form').addEventListener('submit',event=>{event.preventDefault();const f=event.currentTarget;act(async()=>{const data=Object.fromEntries(new FormData(f));data.published=f.elements.published.checked;data.rounds=[...document.querySelectorAll('.round-input')].map(box=>{const get=n=>box.querySelector('[name="'+n+'"]');const scores=get('score').value.split(':').map(Number);return {number:Number(get('number').value),side:get('side').value,map:get('map').value,teamScore:scores[0],opponentScore:scores[1],picks:[...box.querySelectorAll('.round-picks>div')].map(row=>({playerId:row.querySelector('[name=playerId]').value,character:row.querySelector('[name=character]').value})),bans:get('bans').value.split(/[、,，]/).map(s=>s.trim()).filter(Boolean)};});await api('save',data);$('match-editor').hidden=true;internal=true;await refresh();$('match-status').textContent='比赛已保存。';});});
act(async()=>{await refresh();const r=await fetch(new URL('api/account/me',base));if(!r.ok)return;const data=await r.json();if(!data.member)return;$('internal-matches').hidden=false;canManage=['owner','admin'].includes(data.member.role);$('new-match').hidden=!canManage;const profiles=await fetch(new URL('data/team-roster.json',base));if(profiles.ok)players=await profiles.json();});
})();
