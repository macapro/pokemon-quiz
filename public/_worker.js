const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms/create' && request.method === 'POST') {
      const body = await request.json();
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const init = await stub.fetch('https://room.internal/init', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, code })
      });
      if (!init.ok) return json({ error: '방을 생성하지 못했습니다.' }, 500);
      return json({ code });
    }
    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/ws$/);
    if (match) {
      const id = env.ROOMS.idFromName(match[1]);
      const forwarded = new Request('https://room.internal/ws' + url.search, request);
      return env.ROOMS.get(id).fetch(forwarded);
    }
    return env.ASSETS.fetch(request);
  }
};
