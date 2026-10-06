import { handleAccount } from './auth.mjs';
import legacyRoster from './roster.mjs';
export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (path.startsWith('/api/account/')) return handleAccount(request, env);
    if (/^\/players\/p[0-9]{4,8}\/?(?:index\.html)?$/.test(path)) {
      const id = path.split('/')[2];
      return new Response(null, { status:302, headers:{Location:'/player.html?id='+encodeURIComponent(id),'Cache-Control':'no-store'} });
    }
    if (['/data/team-roster.json','/data/team-roster.js'].includes(path) && env.DB) {
      const response=await handleAccount(new Request(new URL('/api/account/profiles',url)),env);
      if (!response.ok) return response;
      const data=await response.json(), claimed=new Set(data.claimed);
      const players=legacyRoster.filter(p=>!claimed.has(p.id)).concat(data.players);
      return new Response(path.endsWith('.js')?'window.HNUST_ROSTER = '+JSON.stringify(players)+';\n':JSON.stringify(players),{headers:{'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if (!env.ASSETS) return new Response('网站暂时不可用', { status:503 });
    return env.ASSETS.fetch(request);
  }
};
