const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms/create' && request.method === 'POST') {
      const body = await request.json();
      const code = String(body.code || '');
      if (!/^\d{4,8}$/.test(code)) return json({ error: '방 코드는 숫자 4~8자리여야 합니다.' }, 400);
      if (!/^\d{4,8}$/.test(String(body.password || ''))) return json({ error: '비밀번호는 숫자 4~8자리여야 합니다.' }, 400);
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const init = await stub.fetch('https://room.internal/init', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, code })
      });
      if (!init.ok) { const detail = await init.json().catch(() => ({})); return json({ error: detail.error || '방을 생성하지 못했습니다.' }, init.status); }
      return json({ code });
    }
    if (url.pathname === '/api/rooms/verify' && request.method === 'POST') {
      const body = await request.json();
      const code = String(body.code || '').toUpperCase();
      if (!/^\d{4,8}$/.test(code) || !/^\d{4,8}$/.test(String(body.password || ''))) return json({ error: '방 코드와 숫자 비밀번호를 확인하세요.' }, 400);
      const id = env.ROOMS.idFromName(code);
      return env.ROOMS.get(id).fetch('https://room.internal/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: String(body.password) })
      });
    }
    const match = url.pathname.match(/^\/api\/rooms\/(\d{4,8})\/ws$/);
    if (match) {
      const id = env.ROOMS.idFromName(match[1]);
      const forwarded = new Request('https://room.internal/ws' + url.search, request);
      return env.ROOMS.get(id).fetch(forwarded);
    }
    return env.ASSETS.fetch(request);
  }
};
