(() => {
  'use strict';
  const suspicious = /(?:\d[\s-]*){11,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|身份证|手机号|学号|微信|真实姓名|联系电话|住址|(?:个人)?QQ\s*[:：]/i;
  const privateHeader = /姓名|身份证|证件|电话|手机|联系方式|联系账号|学号|学生证|生日|出生|住址|地址|宿舍|家庭|微信|QQ|邮箱|学院|专业|籍贯|性别|学院|班级/i;
  const allowedHeader = {
    nickname: /昵称|游戏名|选手名|代号/,
    role: /阵营|求生者.*监管者|监管者.*求生者|^(?:位置|游戏位置|比赛位置|选手位置|角色定位)$/,
    characters: /擅长.*角色|常用.*角色|角色池|主玩.*角色|擅长.*(?:求生者|监管者)|^(?:擅长|常用)$/,
    rank: /段位/
  };
  function headerAllowed(header, field) {
    return typeof header === 'string' && !privateHeader.test(header) && Boolean(allowedHeader[field]?.test(header));
  }
  function roleFrom(value) {
    const v=String(value||'');
    if(/双阵营|双修|双边/.test(v)||(/求生|人队|人类/.test(v)&&/监管|屠/.test(v))) return 'flex';
    if(/监管|屠/.test(v)) return 'hunter';
    if(/求生|人队|人类/.test(v)) return 'survivor';
    return 'support';
  }
  function sanitize(input) {
    const nickname=String(input.nickname||'').trim();
    const characters=String(input.characters||'').split(/[,，、;；\n\/]+/).map(x=>x.trim()).filter(Boolean);
    const rank=String(input.rank||'').trim();
    if(!/^p[0-9]{4,8}$/.test(input.id)) throw Error('档案编号不合法。');
    if(!nickname||nickname.length>32||/^\d+$/.test(nickname)) throw Error('请使用 1–32 字的游戏昵称，不要使用姓名或数字账号。');
    if(!['survivor','hunter','flex','support'].includes(input.role)) throw Error('请选择游戏阵营。');
    if(characters.length>20||characters.some(x=>x.length>40)||rank.length>80) throw Error('角色或段位内容过长，请只保留游戏信息。');
    const output={id:input.id,nickname,role:input.role,characters,rank};
    if(suspicious.test(JSON.stringify(output))) throw Error('检测到号码或私人联系信息，请删除后再导出。');
    return output;
  }
  window.HNUST_PUBLIC={headerAllowed,roleFrom,sanitize};
})();
