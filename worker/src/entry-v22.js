import worker from './index-v24.js';

function cors(request, env) {
  const origin=request.headers.get('Origin')||'';
  const configured=String(env.ALLOWED_ORIGINS||'https://jinlong-github.github.io,http://localhost:8000').split(',').map(value=>value.trim()).filter(Boolean);
  const allowed=configured.includes(origin)||(!origin&&configured[0])?(origin||configured[0]):configured[0];
  return {
    'Access-Control-Allow-Origin':allowed,
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,Accept',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin'
  };
}

export default {
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(request,env)});
    const response=await worker.fetch(request,env,ctx);
    const headers=new Headers(response.headers);
    Object.entries(cors(request,env)).forEach(([name,value])=>headers.set(name,value));
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
