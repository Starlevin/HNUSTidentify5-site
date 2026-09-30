(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const helper=window.HNUST_PUBLIC;
  let workbook=null, rows=[], headers=[], candidates=[];
  let readerPromise;
  const status=message=>$('editor-status').textContent=message;
  function loadReader() {
    if(window.XLSX) return Promise.resolve(window.XLSX);
    if(!readerPromise) readerPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.referrerPolicy='no-referrer';
      script.onload=()=>window.XLSX?resolve(window.XLSX):reject(Error('表格解析器未能加载。'));
      script.onerror=()=>{readerPromise=null;reject(Error('表格解析器加载失败。请检查网络，再重新选择文件。'));};
      document.head.append(script);
    });
    return readerPromise;
  }
  function resetPreview(){candidates=[];$('records-preview').replaceChildren();$('export-records').disabled=true;}
  function configureFields() {
    resetPreview();
    const index=Number($('header-row').value)-1;
    if(!Number.isInteger(index)||index<0||index>=rows.length){status('表头行超出工作表范围。');return;}
    headers=(rows[index]||[]).map(v=>String(v||'').trim());
    const map=[['nickname','map-nickname'],['role','map-role'],['characters','map-characters'],['rank','map-rank']];
    let hasNickname=false;
    map.forEach(([field,id])=>{
      const select=$(id);select.replaceChildren();
      const empty=document.createElement('option');empty.value='';empty.textContent=field==='nickname'?'请选择游戏昵称列':'不读取';select.append(empty);
      headers.forEach((header,i)=>{if(helper.headerAllowed(header,field)){const o=document.createElement('option');o.value=String(i);o.textContent=header;select.append(o);if(field==='nickname')hasNickname=true;}});
      select.disabled=false;
      // A field must be deliberately chosen; no private data is guessed from nearby columns.
    });
    $('preview-records').disabled=!hasNickname;
    status(hasNickname?'已读取表头。只提供游戏字段列，请选择映射后生成预览。':'这行没有明确的游戏昵称列。请调整表头行；如果原表只有真实姓名，请先新增游戏昵称列。');
  }
  function chooseSheet(){if(!workbook)return;rows=window.XLSX.utils.sheet_to_json(workbook.Sheets[$('worksheet').value],{header:1,defval:'',raw:false});configureFields();}
  $('sheet-file').addEventListener('change',async()=>{
    const file=$('sheet-file').files[0];if(!file)return;
    resetPreview();workbook=null;rows=[];headers=[];$('worksheet').disabled=true;$('preview-records').disabled=true;
    ['map-nickname','map-role','map-characters','map-rank'].forEach(id=>{$(id).disabled=true;$(id).replaceChildren();});
    if(file.size>8*1024*1024){status('请选择小于 8 MB 的收集表。');return;}
    status('正在加载表格解析器，然后在本地读取文件。');
    try{
      const reader=await loadReader();const bytes=await file.arrayBuffer();
      workbook=reader.read(bytes,{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false});
      if(!workbook.SheetNames.length)throw Error('未找到工作表。');
      $('worksheet').replaceChildren();workbook.SheetNames.forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;$('worksheet').append(o);});
      $('worksheet').disabled=false;chooseSheet();
    }catch{status('读取失败：请检查网络、文件是否为有效的 Excel / CSV，且未加密。');}
  });
  $('worksheet').addEventListener('change',chooseSheet);
  $('header-row').addEventListener('change',()=>{if(workbook)configureFields();});
  ['map-nickname','map-role','map-characters','map-rank'].forEach(id=>$(id).addEventListener('change',()=>{resetPreview();status('字段映射已变化，请重新生成预览。');}));
  function field(row,id){const v=$(id).value;return v===''?'':String(row[Number(v)]||'').trim();}
  function makeInput(labelText,value) {const label=document.createElement('label');label.append(document.createTextNode(labelText));const input=document.createElement('input');input.type='text';input.value=value;label.append(input);return {label,input};}
  $('preview-records').addEventListener('click',()=>{
    const nickColumn=$('map-nickname').value;
    if(nickColumn===''||!helper.headerAllowed(headers[Number(nickColumn)],'nickname')){status('请先选择明确的游戏昵称列。');return;}
    resetPreview();const start=Number($('header-row').value);let rejected=0;
    rows.slice(start).forEach((row,index)=>{
      const nickname=field(row,'map-nickname');if(!nickname)return;
      let safe;
      try{safe=helper.sanitize({id:'p'+String(start+index).padStart(4,'0'),nickname,role:helper.roleFrom(field(row,'map-role')),characters:field(row,'map-characters'),rank:field(row,'map-rank')});}catch{rejected++;return;}
      const wrapper=document.createElement('div');wrapper.className='editor-row';
      const check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label','公开 '+safe.nickname+' 的游戏档案');
      const fields=document.createElement('div');
      const nick=makeInput('游戏昵称 / 队内代号',safe.nickname);nick.input.maxLength=32;
      const roleLabel=document.createElement('label');roleLabel.textContent='游戏阵营';const role=document.createElement('select');
      [['survivor','求生者'],['hunter','监管者'],['flex','双阵营'],['support','暂未公开']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;role.append(o);});role.value=safe.role;roleLabel.append(role);
      const chars=makeInput('擅长角色（用逗号分隔）',safe.characters.join('、'));
      const rank=makeInput('游戏段位（可留空）',safe.rank);
      fields.append(nick.label,roleLabel,chars.label,rank.label);wrapper.append(check,fields);$('records-preview').append(wrapper);
      candidates.push({id:safe.id,check,nick:nick.input,role,chars:chars.input,rank:rank.input});
      check.addEventListener('change',()=>{$('export-records').disabled=!candidates.some(p=>p.check.checked);});
    });
    if(!candidates.length)$('records-preview').textContent='没有可展示的游戏资料，请检查表头和昵称列。';
    status('已生成 '+candidates.length+' 份游戏资料预览。'+(rejected?'另有 '+rejected+' 行不符合公开字段要求，未加入预览。':'')+'请逐一检查，并勾选允许公开的正式队员。');
  });
  function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  $('export-records').addEventListener('click',()=>{
    const selected=candidates.filter(p=>p.check.checked);if(!selected.length){status('请选择至少一位已确认可公开的队员。');return;}
    try{
      const result=selected.map(p=>helper.sanitize({id:p.id,nickname:p.nick.value,role:p.role.value,characters:p.chars.value,rank:p.rank.value}));
      download(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}),'team-roster.json');
      status('已导出 '+result.length+' 位队员的公开资料。原表与私人字段未包含在导出文件中。');
    }catch(error){status(error.message);}
  });
  $('export-images').addEventListener('click',()=>{
    let count=0;const extensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
    [['badge-file','team-badge'],['qr-file','community-qr']].forEach(([id,name])=>{
      const file=$(id).files[0];if(!file)return;
      const ext=extensions[file.type];if(!ext||file.size>12*1024*1024){status('请使用小于 12 MB 的 JPG、PNG 或 WebP 图片。');return;}
      download(file,name+ext);count++;
    });
    if(count)status('已下载 '+count+' 张按网站名称保存的原图。把这些图片放入仓库 assets 文件夹即可。');
    else status('请先选择队徽或社群二维码原图。');
  });
})();
