// Lokalna atrapa MET Norway do testu w workerd (sandbox nie ma dostępu do api.met.no).
import http from 'node:http';
const base = Number(process.env.BASE || 5);
http.createServer((req, res) => {
  const out = [];
  const start = new Date(); start.setUTCMinutes(0, 0, 0);
  for (let h = 0; h < 9 * 24; h += h < 60 ? 1 : 6) {
    const t = new Date(start.getTime() + h * 3600e3);
    const hr = (t.getUTCHours() + 2) % 24;
    out.push({ time: t.toISOString(), data: { instant: { details: { air_temperature: Math.round((base + 4 * Math.sin(((hr - 9) / 24) * 2 * Math.PI)) * 10) / 10 } } } });
  }
  console.log('MET mock hit', req.url, 'UA=', req.headers['user-agent']);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ properties: { meta: { updated_at: new Date().toISOString() }, timeseries: out } }));
}).listen(9911, () => console.log('mock MET on 9911'));
