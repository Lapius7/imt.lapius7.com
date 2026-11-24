/**
 * 実 MySQL を使った通し確認。ローカルの MySQL(別 DB imt_test)に対して、サーバーを実際に起動して調べる。
 *   MYSQL_PASSWORD=... bun test/e2e.ts
 * 1) 2 文字の目標文で全文一致まで動かし、完了状態を確認  2) 保持数の上限(古いものから削除)
 * 3) kill -9 で止めて再起動し、累計・現在の一致長が引き継がれ、止まっていた間の分が増えないこと
 * 4) 二重起動(生成ロック)  5) SSE の再接続
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";

const PORT = 8432;
const base = `http://127.0.0.1:${PORT}`;
const dbEnv = {
  MYSQL_HOST: "127.0.0.1",
  MYSQL_PORT: process.env.MYSQL_PORT ?? "3318",
  MYSQL_USER: "imt",
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ?? "",
  MYSQL_DATABASE: "imt_test",
};
const dir = mkdtempSync(join(tmpdir(), "imt-e2e-"));
const targetFile = join(dir, "target.txt");
writeFileSync(targetFile, "あい\n");

const conn = await mysql.createConnection({ host: dbEnv.MYSQL_HOST, port: +dbEnv.MYSQL_PORT, user: "imt", password: dbEnv.MYSQL_PASSWORD, database: "imt_test" });
const reset = async () => {
  await conn.query("DROP TABLE IF EXISTS imt_chars");
  await conn.query("DROP TABLE IF EXISTS imt_state");
};
const spawn = (extra: Record<string, string> = {}) =>
  Bun.spawn(["bun", "server/index.ts"], {
    env: { ...process.env, ...dbEnv, PORT: String(PORT), IMT_TEST: "1", TARGET_FILE: targetFile, TICK_MS: "5", RETAIN_CHARS: "500", ...extra },
    stdout: "pipe",
    stderr: "pipe",
  });
const state = async () => (await (await fetch(`${base}/api/state`)).json()) as any;
const waitUp = async () => {
  for (let i = 0; i < 100; i++) {
    try {
      return await state();
    } catch {
      await Bun.sleep(100);
    }
  }
  throw new Error("起動しない");
};
const ok = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "OK  " : "FAIL"} ${name} ${detail}`);
  if (!cond) process.exitCode = 1;
};

// --- 1) 完了まで ---
await reset();
let p = spawn();
await waitUp();
let s: any;
const t0 = Date.now();
for (;;) {
  s = await state();
  if (s.state.completedAt) break;
  if (Date.now() - t0 > 60_000) break;
  await Bun.sleep(200);
}
ok("全文一致で完了状態になる", !!s.state.completedAt, `total=${s.state.total} completedAt=${s.state.completedAt}`);
ok("完了時 best=目標長 cur=目標長", s.state.best === 2 && s.state.cur === 2);
const doneTotal = s.state.total;
await Bun.sleep(600);
ok("完了後は増えない", (await state()).state.total === doneTotal);
const [rows1] = (await conn.query("SELECT COUNT(*) AS n, MAX(id) AS mx FROM imt_chars")) as any;
ok("保持は上限 500 文字以内で古いものから削除", Number(rows1[0].n) <= 500 && Number(rows1[0].mx) === doneTotal, `rows=${rows1[0].n} max=${rows1[0].mx}`);
p.kill();
await p.exited;

// --- 2) kill -9 と再起動(別の、完了しない 3 文字の目標で)---
writeFileSync(targetFile, "あいう\n");
await reset();
p = spawn({ TICK_MS: "20", RETAIN_CHARS: "30" });
await waitUp();
await Bun.sleep(3000);
const before = await state();
p.kill("SIGKILL");
await p.exited;
const [dbRow] = (await conn.query("SELECT total, cur_len, best_len FROM imt_state")) as any;
const [ret] = (await conn.query("SELECT COUNT(*) AS n, MIN(id) AS mn, MAX(id) AS mx FROM imt_chars")) as any;
ok("保持数 30 で古いものから削除される", Number(ret[0].n) === 30 && Number(ret[0].mn) === Number(ret[0].mx) - 29, `total=${dbRow[0].total} rows=${ret[0].n} id=${ret[0].mn}..${ret[0].mx}`);
await Bun.sleep(1500); // 停止中の空白
p = spawn({ TICK_MS: "20", RETAIN_CHARS: "30" });
const after0 = await waitUp();
ok("再起動後の累計は停止前の保存値以上で、空白の分は増えていない", after0.state.total >= Number(dbRow[0].total) && after0.state.total - Number(dbRow[0].total) < 60, `kill 前の DB=${dbRow[0].total} 再起動直後=${after0.state.total}`);
ok("最長一致が引き継がれる", after0.state.best >= before.state.best);
// 保存済み(DB)の現在の一致長が再起動後の初期値になる: 再起動直後の cur は DB の cur_len か、そこから 1 進んだ値
ok("startedAt が保たれる", after0.state.startedAt === before.state.startedAt);

// --- 3) 二重起動 ---
const q = Bun.spawn(["bun", "server/index.ts"], { env: { ...process.env, ...dbEnv, PORT: "8433", IMT_TEST: "1", TARGET_FILE: targetFile, TICK_MS: "20" }, stdout: "pipe", stderr: "pipe" });
const code = await Promise.race([q.exited, Bun.sleep(30_000).then(() => "timeout")]);
ok("二重起動は生成ロックで終了する", code === 1, `exit=${code}`);

// --- 4) SSE と再接続 ---
const readEvents = async (ms: number, headers: Record<string, string> = {}) => {
  const res = await fetch(`${base}/api/stream`, { headers });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await Promise.race([reader.read(), Bun.sleep(end - Date.now()).then(() => null)]);
    if (!r || r.done) break;
    buf += dec.decode(r.value);
  }
  await reader.cancel();
  const events = buf.split("\n\n").filter((b) => b.startsWith("event:") || b.includes("\nevent:"));
  return { res, events };
};
const a = await readEvents(800);
ok("SSE: Content-Type と X-Accel-Buffering", a.res.headers.get("content-type")?.includes("text/event-stream") === true && a.res.headers.get("x-accel-buffering") === "no");
ok("SSE: 最初に snapshot、続けて char", a.events[0]!.includes("event: snapshot") && a.events.some((e) => e.includes("event: char")), `events=${a.events.length}`);
const lastId = Math.max(...a.events.filter((e) => e.includes("event: char")).map((e) => +/id: (\d+)/.exec(e)![1]!));
await Bun.sleep(500); // 切断中に生成される分
const b = await readEvents(300, { "Last-Event-ID": String(lastId) });
const snap = JSON.parse(/data: (.*)/.exec(b.events[0]!)![1]!);
const ids: number[] = snap.recent.map((r: any) => r.id);
ok("再接続の snapshot に、切断中に生成された文字が含まれる", ids.includes(lastId + 1) && ids.includes(snap.state.total), `lastId=${lastId} snapshot=${ids[0]}..${ids.at(-1)}`);

p.kill();
await p.exited;
await conn.end();
