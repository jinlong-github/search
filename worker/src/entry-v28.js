import worker from './entry-v22-legacy.js';

function clean(value=''){return String(value??'').replace(/\s+/g,' ').trim()}
function cors(request,env){
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
function json(request,env,data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...cors(request,env)}})}
function responseOutputText(data){
  const parts=[];
  for(const item of data?.output||[])for(const content of item?.content||[])if(content?.type==='output_text'&&content.text)parts.push(content.text);
  return parts.join('\n').trim();
}
function chatOutputText(data){
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content==='string')return content.trim();
  if(Array.isArray(content))return content.map(part=>part?.text||part?.content||'').filter(Boolean).join('\n').trim();
  return '';
}
function parseModelJson(text=''){
  const raw=String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  try{return JSON.parse(raw)}catch{}
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start>=0&&end>start){try{return JSON.parse(raw.slice(start,end+1))}catch{}}
  return null;
}
function usageOf(data,mode){
  const usage=data?.usage||{};
  if(mode==='chat-completions')return{input_tokens:Number(usage.prompt_tokens||0),output_tokens:Number(usage.completion_tokens||0),total_tokens:Number(usage.total_tokens||0),cached_input_tokens:Number(usage.prompt_tokens_details?.cached_tokens||0),reasoning_tokens:Number(usage.completion_tokens_details?.reasoning_tokens||0)};
  return{input_tokens:Number(usage.input_tokens||0),output_tokens:Number(usage.output_tokens||0),total_tokens:Number(usage.total_tokens||0),cached_input_tokens:Number(usage.input_tokens_details?.cached_tokens||0),reasoning_tokens:Number(usage.output_tokens_details?.reasoning_tokens||0)};
}
function promptFor(items,style){
  const lengthRule=style==='brief'?'每条 1 句，约 35–60 个中文字符':style==='detailed'?'每条 2–3 句，约 90–150 个中文字符':'每条 1–2 句，约 55–100 个中文字符';
  return `你是科研情报系统的中文技术摘要器。\n规则：\n1. ${lengthRule}。\n2. 保留关键英文技术术语、缩写、模型名和标准号。\n3. 不得补充输入中没有的实验结果、性能数字、机构关系、引用关系、专利关系或因果关系。\n4. 信息不足时明确表达信息边界，不得猜测。\n5. 必须返回严格 JSON，不要 Markdown，不要解释。格式：{"summaries":[{"key":"原 key","summary":"中文摘要"}]}。\n\n输入记录：\n${JSON.stringify(items)}`;
}
function simpleConfig(raw){
  const url=clean(raw?.url).replace(/\/+$/,'');
  const api=String(raw?.api??'').trim();
  const name=clean(raw?.name).slice(0,200);
  if(!url||!api||!name)return null;
  if(api.length>8192)throw new Error('API Key 过长');
  let parsed;
  try{parsed=new URL(url)}catch{throw new Error('AI URL 无效')}
  if(parsed.protocol!=='https:')throw new Error('AI URL 必须使用 HTTPS');
  const host=parsed.hostname.toLowerCase();
  if(!host||host==='localhost'||host.endsWith('.local')||/^\d+(?:\.\d+){3}$/.test(host)||host.includes(':'))throw new Error('AI URL 主机不允许使用本地或 IP 地址');
  if(parsed.username||parsed.password)throw new Error('AI URL 不能包含用户名或密码');
  const lower=parsed.pathname.replace(/\/+$/,'').toLowerCase();
  if(lower.endsWith('/chat/completions'))return{url,api,name,candidates:[{mode:'chat-completions',endpoint:url}]};
  if(lower.endsWith('/responses'))return{url,api,name,candidates:[{mode:'responses',endpoint:url}]};
  return{url,api,name,candidates:[{mode:'responses',endpoint:`${url}/responses`},{mode:'chat-completions',endpoint:`${url}/chat/completions`}]};
}
function errorText(data,status){return clean(data?.error?.message||data?.error||data?.message||`AI 上游请求失败 (${status})`)}

async function callUpstream(config,prompt){
  let last=null;
  for(let index=0;index<config.candidates.length;index++){
    const candidate=config.candidates[index];
    const payload=candidate.mode==='chat-completions'
      ?{model:config.name,messages:[{role:'system',content:'遵守科研证据边界，并严格按用户消息中的 JSON 格式返回。'},{role:'user',content:prompt}],max_tokens:1800}
      :{model:config.name,input:prompt,store:false,max_output_tokens:1800};
    const response=await fetch(candidate.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':`Bearer ${config.api}`},body:JSON.stringify(payload)});
    const data=await response.json().catch(()=>({}));
    if(response.ok)return{response,data,mode:candidate.mode,endpoint:candidate.endpoint};
    last={response,data,mode:candidate.mode,endpoint:candidate.endpoint};
    const canFallback=index<config.candidates.length-1&&[400,404,405,422].includes(response.status);
    if(!canFallback)break;
  }
  return last;
}

async function simpleAiSummaries(request,env,body){
  let config;
  try{config=simpleConfig(body.ai)}catch(error){return json(request,env,{error:error.message,code:'SIMPLE_AI_CONFIG_INVALID'},400)}
  if(!config)return null;
  if(!Array.isArray(body.items))return json(request,env,{error:'请求体必须包含 items 数组',code:'BAD_BODY'},400);
  const style=['brief','standard','detailed'].includes(body.style)?body.style:'standard';
  const items=body.items.slice(0,16).map(item=>({key:clean(item.key).slice(0,500),type:clean(item.type).slice(0,40),title:clean(item.title).slice(0,600),source:clean(item.source).slice(0,300),year:item.year||null,authors:Array.isArray(item.authors)?item.authors.map(clean).filter(Boolean).slice(0,6):[],text:clean(item.text).slice(0,1800)})).filter(item=>item.key&&item.title);
  if(!items.length)return json(request,env,{error:'没有可处理的结果',code:'EMPTY_ITEMS'},400);
  const prompt=promptFor(items,style);
  const started=Date.now();
  let upstream;
  try{upstream=await callUpstream(config,prompt)}catch(error){return json(request,env,{error:error?.message||'AI 上游连接失败',code:'AI_UPSTREAM_CONNECT_ERROR'},502)}
  if(!upstream?.response?.ok)return json(request,env,{error:errorText(upstream?.data,upstream?.response?.status||502),code:'AI_UPSTREAM_ERROR',provider:'Custom AI',model:config.name,protocol:upstream?.mode||'unknown'},upstream?.response?.status||502);
  const output=upstream.mode==='chat-completions'?chatOutputText(upstream.data):responseOutputText(upstream.data);
  const parsed=parseModelJson(output);
  const summaries=Array.isArray(parsed?.summaries)?parsed.summaries.map(entry=>({key:clean(entry.key),summary:clean(entry.summary)})).filter(entry=>entry.key&&entry.summary):[];
  const usage=usageOf(upstream.data,upstream.mode);
  if(!summaries.length)return json(request,env,{error:'AI 返回内容无法解析为摘要 JSON',code:'AI_PARSE_ERROR',raw_preview:output.slice(0,500),provider:'Custom AI',protocol:upstream.mode,model:config.name,usage,duration_ms:Math.max(0,Date.now()-started)},502);
  return json(request,env,{summaries,count:summaries.length,response_id:clean(upstream.data?.id||''),provider:'Custom AI',protocol:upstream.mode,model:config.name,usage,estimated_cost_usd:null,pricing_configured:false,duration_ms:Math.max(0,Date.now()-started)});
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    if(request.method==='POST'&&url.pathname==='/api/ai/summaries'){
      const body=await request.clone().json().catch(()=>null);
      if(body?.ai){
        const response=await simpleAiSummaries(request,env,body);
        if(response)return response;
      }
    }
    const response=await worker.fetch(request,env,ctx);
    if(request.method==='GET'&&url.pathname==='/api/status'&&response.ok){
      const data=await response.clone().json().catch(()=>null);
      if(data&&typeof data==='object'){
        data.service_version='research-os-v28';
        data.capabilities={...(data.capabilities||{}),simple_ai_config:true,simple_ai_fields:['url','api','name']};
        const headers=new Headers(response.headers);headers.set('Content-Type','application/json; charset=utf-8');
        return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
      }
    }
    return response;
  }
};
