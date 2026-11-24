import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { config } from "./config.ts";
import { Engine } from "./engine.ts";
import { Store } from "./store.ts";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const fatal = (msg: string, e?: unknown) => {
  console.error(new Date().toISOString(), msg, e ?? "");
  process.exit(1);
};

const store = new Store(config.db, config.retain);
await store.migrate().catch((e) => fatal("DB に接続できない・テーブルを作れない", e));

// 生成は 1 プロセスだけ。再起動の重なりに備え、ロックを最大 20 秒待つ。
const locked = await store.acquireLock(20, (e) => fatal("生成ロックを失った", e)).catch((e) => fatal("ロックの取得に失敗", e));
if (!locked) fatal("別のプロセスが生成中のため終了する");

const initial = await store.loadOrInit(config.targetSha, config.target.length, Date.now()).catch((e) => fatal("状態を読めない", e));
const engine = new Engine({
  target: config.target,
  state: initial,
  store,
  tickMs: config.tickMs,
  onError: (e) => console.error(new Date().toISOString(), "保存に失敗(この文字は数えない)", e),
});
engine.seedRecent((await store.recent(300)).reverse());
engine.start();
log(`起動: 目標 ${config.target.length} 文字 / 累計 ${initial.total} / 現在の一致 ${initial.cur} / 最長 ${initial.best} / 間隔 ${config.tickMs}ms`);

const snapshot = (n = 200) => ({
  state: engine.state,
  targetLength: config.target.length,
  tickMs: config.tickMs,
  retain: config.retain,
  now: Date.now(),
  recent: engine.recent.slice(-n),
});

const MAX_STREAMS = 2000;
let streams = 0;

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, total: engine.state.total }));

app.get("/api/state", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json(snapshot());
});

app.get("/api/target", (c) => {
  c.header("Cache-Control", "public, max-age=3600");
  return c.text(config.target.join(""));
});

const textJson = await Bun.file(`${config.root}/data/text.json`).text();
app.get("/api/text", (c) => {
  c.header("Cache-Control", "public, max-age=3600");
  c.header("Content-Type", "application/json; charset=UTF-8");
  return c.body(textJson);
});

app.get("/api/recent", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 600, 1), 2000);
  const beforeQ = c.req.query("before");
  const before = beforeQ === undefined ? undefined : Number(beforeQ);
  if (before !== undefined && !Number.isFinite(before)) return c.json({ error: "before が不正" }, 400);
  c.header("Cache-Control", "no-store");
  return c.json({ rows: await store.recent(limit, before) }); // 新しい順
});

app.get("/api/stream", (c) => {
  if (streams >= MAX_STREAMS) return c.text("接続が多すぎます", 503);
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-store");
  return streamSSE(c, async (stream) => {
    streams++;
    // 接続(再接続)のたびに最新の状態と直近の文字を送る。クライアントは id で重複を除く。
    await stream.writeSSE({ event: "snapshot", id: String(engine.state.total), data: JSON.stringify(snapshot()) });
    const unsub = engine.subscribe(({ row, state }) => {
      void stream.writeSSE({ event: "char", id: String(row.id), data: JSON.stringify({ row, state }) }).catch(() => {});
    });
    stream.onAbort(() => {
      unsub();
      streams--;
    });
    while (!stream.aborted) {
      await stream.sleep(8000);
      await stream.write(": hb\n\n").catch(() => {});
    }
  });
});

const dist = "./dist";
app.use("/assets/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "public, max-age=31536000, immutable");
});
app.use("/*", serveStatic({ root: dist }));
app.get("/", serveStatic({ path: `${dist}/index.html` }));
app.get("/text/", (c) => c.redirect("/text", 301));
app.get("/text", serveStatic({ path: `${dist}/text.html` }));
app.notFound((c) => c.text("見つかりません", 404));

const server = Bun.serve({ port: config.port, hostname: "127.0.0.1", idleTimeout: 255, fetch: app.fetch });
log(`listening http://127.0.0.1:${server.port}`);

let closing = false;
const shutdown = async (sig: string) => {
  if (closing) return;
  closing = true;
  log(`${sig}: 停止`);
  await engine.stop();
  await store.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
