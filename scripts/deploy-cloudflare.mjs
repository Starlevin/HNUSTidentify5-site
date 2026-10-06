// Run only after tests/build. Secrets are read from environment and never printed.
import { writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const pepper = process.env.AUTH_PEPPER;
const setup = process.env.ADMIN_SETUP_TOKEN;
if (!account || !token || !pepper || pepper.length < 32 || !setup || setup.length < 32) {
  throw Error('Configure CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, AUTH_PEPPER and ADMIN_SETUP_TOKEN as GitHub Actions secrets; both app secrets need at least 32 characters.');
}
async function api(path, method='GET', body) {
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+path, {method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const result = await r.json();
  if (!r.ok || !result.success) throw Error('Cloudflare resource setup failed (HTTP '+r.status+'). Check token permissions.');
  return result.result;
}
const name = 'hnust-identityv-accounts';
const databases = await api('/d1/database?per_page=100');
let db = databases.find(d=>d.name===name);
if (!db) db = await api('/d1/database','POST',{name});
if (!db.uuid) throw Error('Cloudflare returned no database ID.');
const config = '.cloudflare-deploy.json';
await writeFile(config,JSON.stringify({name,main:'worker/index.mjs',compatibility_date:'2026-05-15',workers_dev:true,assets:{directory:'./dist',binding:'ASSETS',run_worker_first:['/api/*','/data/*','/players/*']},d1_databases:[{binding:'DB',database_name:name,database_id:db.uuid,migrations_dir:'migrations'}]},null,2));
function wrangler(args,input) {
  const r = spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--config',config],{env:process.env,stdio:input?['pipe','inherit','inherit']:'inherit',input,encoding:'utf8'});
  if (r.error || r.status!==0) throw Error('Cloudflare deployment step failed. Existing data has not been reset.');
}
try {
  wrangler(['d1','migrations','apply',name,'--remote']);
  // Bulk upload creates the Worker if necessary; never place secrets in generated config.
  wrangler(['secret','bulk'],JSON.stringify({AUTH_PEPPER:pepper,ADMIN_SETUP_TOKEN:setup}));
  wrangler(['deploy']);
  console.log('Deployment complete. Use the HTTPS workers.dev URL printed above; open /account.html to create the first owner with the private initialization code.');
} finally { await unlink(config).catch(()=>{}); }
