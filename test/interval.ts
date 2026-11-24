/** 稼働中のサーバーの SSE を受け、生成間隔を測る: bun test/interval.ts <URL> <秒数> */
const url = process.argv[2] ?? "http://127.0.0.1:8431";
const secs = Number(process.argv[3] ?? 25);
const res = await fetch(`${url}/api/stream`);
const reader = res.body!.getReader();
const dec = new TextDecoder();
let buf = "";
const ts: number[] = [];
const end = Date.now() + secs * 1000;
while (Date.now() < end) {
  const r = await Promise.race([reader.read(), Bun.sleep(Math.max(end - Date.now(), 1)).then(() => null)]);
  if (!r || r.done) break;
  buf += dec.decode(r.value);
  let i;
  while ((i = buf.indexOf("\n\n")) >= 0) {
    const ev = buf.slice(0, i);
    buf = buf.slice(i + 2);
    if (ev.includes("event: char")) ts.push(JSON.parse(/data: (.*)/.exec(ev)![1]!).row.ts);
  }
}
await reader.cancel();
const d = ts.slice(1).map((t, i) => t - ts[i]!);
console.log(`受信 ${ts.length} 文字 / 間隔(ms) 平均 ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)} 最小 ${Math.min(...d)} 最大 ${Math.max(...d)}`);
