import pokemonData from './pokemon-data.json' with { type: 'json' };

const TYPES = pokemonData.types || {};
const GENS = pokemonData.generations || {};
const DEX = pokemonData.descriptions || {};
const NAMES = Object.keys(TYPES);
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = value => String(value || '').trim().replace(/\s+/g, '').slice(0, 40);
const initial = name => { const a=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']; return [...name].map(ch=>{const n=ch.charCodeAt(0)-44032;return n>=0&&n<=11171?a[Math.floor(n/588)]:ch}).join(''); };
function newQuestion(number) { const answer=NAMES[Math.floor(Math.random()*NAMES.length)]; return { answer, cho:initial(answer), length:[...answer].length, number, phase:'question', deadline:Date.now()+120000 }; }
let dexNumberMapPromise=null;
async function hintText(answer, count) {
  const mega=answer.startsWith('메가'); const last=/[XYZ]$/.test(answer)?answer.slice(-2):[...answer].slice(-1)[0];
  if(count===1)return '타입: '+(TYPES[answer]||'정보 없음');
  if(count===2)return '세대: '+(GENS[answer]||'정보 없음');
  if(count===3)return '첫 글자: '+(mega?'메가':[...answer][0])+' / 마지막 글자: '+last;
  if(count===4){
    if(DEX[answer])return '도감 설명: '+DEX[answer];
    try{
      if(!dexNumberMapPromise)dexNumberMapPromise=fetch('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv').then(r=>{if(!r.ok)throw Error('CSV');return r.text()}).then(csv=>{const map={};for(const line of csv.split(/\r?\n/)){const m=line.match(/^(\d+),3,(".*?"|[^,]*),/);if(m)map[m[2].replace(/^"|"$/g,'')]=Number(m[1]);}return map;});
      const dexMap=await dexNumberMapPromise;const id=dexMap[answer];if(!id)return '아직 등록되지 않은 도감 설명입니다.';
      const response=await fetch('https://pokeapi.co/api/v2/pokemon-species/'+id+'/');if(!response.ok)throw Error('API');const info=await response.json();const entries=info.flavor_text_entries||[];
      for(let i=entries.length-1;i>=0;i--)if(entries[i].language?.name==='ko'&&entries[i].flavor_text?.trim())return '도감 설명: '+entries[i].flavor_text.replace(/[\n\r\f]+/g,' ').replace(/\s{2,}/g,' ').trim();
    }catch(e){return '도감 설명을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';}
    return '아직 등록되지 않은 도감 설명입니다.';
  }
  return '';
}

export class PokemonRoom {
  constructor(state, env) { this.state=state; this.env=env; this.clients=new Map(); this.room=null; }
  async load() { if(!this.room) this.room=await this.state.storage.get('room'); return this.room; }
  async save() { await this.state.storage.put('room',this.room); }
  publicQuestion() { if(!this.room?.question)return null; const q=this.room.question; const out={cho:q.cho,length:q.length,number:q.number,phase:q.phase,deadline:q.deadline}; if(q.phase==='reveal')out.answer=q.answer; return out; }
  players() { return Object.values(this.room?.players||{}).map(p=>({id:p.id,name:p.name,score:p.score||0,isHost:p.id===this.room.hostId})).sort((a,b)=>b.score-a.score); }
  send(ws, payload) { try { ws.send(JSON.stringify(payload)); } catch {} }
  broadcast(payload) { for(const ws of this.clients.keys())this.send(ws,payload); }
  sendState(ws, playerId) { const p=this.room.players[playerId]||{score:0}; this.send(ws,{type:'state',question:this.publicQuestion(),players:this.players(),me:{score:p.score||0,isHost:playerId===this.room.hostId}}); }
  async fetch(request) {
    const url=new URL(request.url); const path=url.pathname;
    if(path==='/init' && request.method==='POST') {
      const body=await request.json(); await this.load(); if(this.room)return json({error:'이미 사용 중인 방 코드입니다. 다른 코드를 선택하세요.'},409); const code=String(body.code||''); if(!/^\d{4,8}$/.test(code))return json({error:'방 코드는 숫자 4~8자리여야 합니다.'},400); const playerId=String(body.playerId||'host').slice(0,64); const name=String(body.name||'플레이어').slice(0,14); const password=String(body.password||''); if(!/^\d{4,8}$/.test(password))return json({error:'비밀번호는 숫자 4~8자리여야 합니다.'},400);
      this.room={code:body.code,password,hostId:playerId,players:{[playerId]:{id:playerId,name,score:0,hints:0}},question:newQuestion(1),createdAt:Date.now()}; await this.save(); await this.state.storage.setAlarm(this.room.question.deadline); return json({ok:true});
    }
    if(path==='/verify' && request.method==='POST') {
      await this.load(); if(!this.room)return json({error:'방을 찾을 수 없습니다.'},404);
      const body=await request.json(); if(String(body.password||'')!==this.room.password)return json({error:'비밀번호가 틀렸습니다.'},403);
      return json({ok:true});
    }
    if(path==='/ws') {
      if(request.headers.get('Upgrade')!=='websocket')return new Response('Expected websocket',{status:426});
      await this.load(); if(!this.room)return json({error:'방을 찾을 수 없습니다.'},404);
      const playerId=(url.searchParams.get('playerId')||'guest').slice(0,64); const name=(url.searchParams.get('name')||'플레이어').slice(0,14); const password=String(url.searchParams.get('password')||''); if(password!==this.room.password)return json({error:'비밀번호가 틀렸습니다.'},403);
      if(!this.room.players[playerId])this.room.players[playerId]={id:playerId,name,score:0,hints:0}; else this.room.players[playerId].name=name;
      await this.save(); const pair=new WebSocketPair(); const client=pair[0],server=pair[1]; server.accept(); this.clients.set(server,playerId);
      server.addEventListener('message',event=>this.onMessage(server,playerId,event.data));
      server.addEventListener('close',()=>{this.clients.delete(server);this.broadcast({type:'state',question:this.publicQuestion(),players:this.players(),me:{score:0}})});
      server.addEventListener('error',()=>this.clients.delete(server));
      this.sendState(server,playerId); this.broadcast({type:'state',question:this.publicQuestion(),players:this.players(),me:{score:0}});
      return new Response(null,{status:101,webSocket:client});
    }
    return json({error:'Not found'},404);
  }
  async onMessage(ws,playerId,raw) {
    let msg; try{msg=JSON.parse(raw)}catch{return}
    await this.load(); if(!this.room)return; const player=this.room.players[playerId]; if(!player)return;
    if(msg.action==='changePassword') { if(playerId!==this.room.hostId){this.send(ws,{type:'error',message:'방장만 비밀번호를 변경할 수 있습니다.'});return;} const next=String(msg.password||''); if(!/^\d{4,8}$/.test(next)){this.send(ws,{type:'error',message:'비밀번호는 숫자 4~8자리여야 합니다.'});return;} this.room.password=next; await this.save(); this.send(ws,{type:'passwordChanged'}); return; }
    if(msg.action==='hint') {
      if(this.room.question.phase!=='question')return; const kinds={type:1,gen:2,letters:3,dex:4}; const count=kinds[msg.kind]; if(!count||count<=player.hints)return;
      player.hints=count; await this.save(); this.send(ws,{type:'hint',kind:msg.kind,text:await hintText(this.room.question.answer,count)}); return;
    }
    if(msg.action==='answer') {
      const q=this.room.question; if(q.phase!=='question')return; const attempt=clean(msg.answer); if(attempt!==clean(q.answer)){this.send(ws,{type:'result',message:'아쉬워요! 다시 생각해 보세요.',score:player.score||0});return;}
      const earned=Math.max(0,14-(player.hints||0)*2); player.score=(player.score||0)+earned; q.phase='reveal'; q.deadline=Date.now()+5000; await this.save(); await this.state.storage.setAlarm(q.deadline);
      this.broadcast({type:'result',message:`🎉 ${player.name}님 정답! ${q.answer} · +${earned}P`,answer:q.answer,score:player.score,players:this.players()}); this.broadcast({type:'state',question:this.publicQuestion(),players:this.players(),me:{score:player.score}}); return;
    }
    if(msg.action==='next' && qSafe(this.room.question)) { await this.advance(); return; }
    if(msg.action==='leave') {
      // 방장이 나가면 방 전체를 종료하고 저장된 방 데이터를 삭제한다.
      // 일반 참가자는 본인만 퇴장하며 방은 계속 유지된다.
      if(playerId===this.room.hostId) {
        await this.endRoom();
        return;
      }
      delete this.room.players[playerId];
      await this.save();
      this.broadcast({type:'state',question:this.publicQuestion(),players:this.players(),me:{score:0}});
    }
  }
  async endRoom() {
    if(!this.room)return;
    this.broadcast({type:'roomEnded',message:'방장이 게임을 종료하여 방이 초기화되었습니다.'});
    for(const ws of this.clients.keys()) {
      try { ws.close(1000,'Room ended'); } catch {}
    }
    this.clients.clear();
    try { await this.state.storage.deleteAlarm(); } catch {}
    this.room=null;
    await this.state.storage.deleteAll();
  }
  async advance() { if(!this.room)return; this.room.question=newQuestion((this.room.question?.number||0)+1); for(const p of Object.values(this.room.players))p.hints=0; await this.save(); await this.state.storage.setAlarm(this.room.question.deadline); this.broadcast({type:'state',question:this.publicQuestion(),players:this.players(),me:{score:0}}); }
  async alarm() { await this.load(); if(!this.room?.question)return; const q=this.room.question; if(q.phase==='question'&&Date.now()>=q.deadline){q.phase='reveal';q.deadline=Date.now()+5000;await this.save();await this.state.storage.setAlarm(q.deadline);this.broadcast({type:'result',message:'⏰ 시간 종료! 정답은 '+q.answer+' 입니다.',answer:q.answer});this.broadcast({type:'state',question:this.publicQuestion(),players:this.players(),me:{score:0}});}else if(q.phase==='reveal'&&Date.now()>=q.deadline){await this.advance();}else await this.state.storage.setAlarm(q.deadline); }
}
function qSafe(q){return !!q;}


export default { async fetch() { return new Response('Pokemon room Durable Object', { status: 200 }); } };
