import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");

/** テスト用の上書き(間隔・保持数・目標文)は IMT_TEST=1 のときだけ効く。本番では固定値。 */
const testMode = process.env.IMT_TEST === "1";
const num = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d);

const targetFile = testMode && process.env.TARGET_FILE ? resolve(process.env.TARGET_FILE) : resolve(root, "data/target.txt");
const targetText = readFileSync(targetFile, "utf8").trim();

export const config = {
  root,
  port: num(process.env.PORT, 8430),
  baseUrl: process.env.BASE_URL ?? "https://imt.lapius7.com",
  tickMs: testMode ? num(process.env.TICK_MS, 1000) : 1000,
  retain: testMode ? num(process.env.RETAIN_CHARS, 86400) : 86400,
  target: Array.from(targetText),
  targetSha: createHash("sha256").update(targetText).digest("hex"),
  db: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: num(process.env.MYSQL_PORT, 3306),
    user: process.env.MYSQL_USER ?? "imt",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "imt",
  },
  testMode,
};
