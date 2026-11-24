import mysql, { type Pool, type Connection, type RowDataPacket } from "mysql2/promise";

export interface State {
  total: number; // 累計生成文字数(実際に生成した分だけ)
  cur: number; // 現在の一致の長さ
  best: number; // 最長一致の長さ(その文字列は目標文の先頭 best 文字)
  bestAt: number | null; // 最長一致を更新した時刻(ms)
  startedAt: number; // 最初の生成の時刻(ms)
  completedAt: number | null; // 全文一致した時刻(ms)
}

export interface CharRow {
  id: number;
  ch: string;
  ts: number;
}

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** MySQL への永続化。状態(1行)と直近 N 文字だけを持つ。 */
export class Store {
  private pool: Pool;
  private lockConn: Connection | null = null;

  constructor(
    private cfg: DbConfig,
    private retain: number,
  ) {
    this.pool = mysql.createPool({
      ...cfg,
      charset: "utf8mb4",
      connectionLimit: 4,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
  }

  /** 生成の担当を 1 つに保つ。専用の 1 接続で GET_LOCK を取り、その接続が切れたら onLost を呼ぶ。 */
  async acquireLock(waitSec: number, onLost: (e: unknown) => void): Promise<boolean> {
    const conn = await mysql.createConnection({ ...this.cfg, charset: "utf8mb4" });
    const [rows] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK(?, ?) AS ok", [`imt:generator:${this.cfg.database}`, waitSec]);
    if (rows[0]?.ok !== 1) {
      await conn.end().catch(() => {});
      return false;
    }
    conn.on("error", onLost);
    conn.on("end", () => onLost(new Error("ロック用の接続が閉じた")));
    this.lockConn = conn;
    return true;
  }

  async migrate(): Promise<void> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS imt_state (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      total BIGINT UNSIGNED NOT NULL,
      cur_len INT UNSIGNED NOT NULL,
      best_len INT UNSIGNED NOT NULL,
      best_at BIGINT NULL,
      started_at BIGINT NOT NULL,
      completed_at BIGINT NULL,
      target_sha CHAR(64) NOT NULL,
      target_len INT UNSIGNED NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS imt_chars (
      id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      ch CHAR(1) NOT NULL,
      ts BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  /** 保存済みの状態。無ければ初期化する。目標文が変わっていたら例外(統計の意味が変わるため)。 */
  async loadOrInit(targetSha: string, targetLen: number, now: number): Promise<State> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT * FROM imt_state WHERE id = 1");
    const r = rows[0];
    if (!r) {
      await this.pool.query(
        "INSERT INTO imt_state (id,total,cur_len,best_len,best_at,started_at,completed_at,target_sha,target_len) VALUES (1,0,0,0,NULL,?,NULL,?,?)",
        [now, targetSha, targetLen],
      );
      return { total: 0, cur: 0, best: 0, bestAt: null, startedAt: now, completedAt: null };
    }
    if (r.target_sha !== targetSha) {
      throw new Error("保存済みの状態と目標文が一致しない(目標文を作り直した場合は、DB の imt_state と imt_chars を空にしてから起動する)");
    }
    return {
      total: Number(r.total),
      cur: Number(r.cur_len),
      best: Number(r.best_len),
      bestAt: r.best_at === null ? null : Number(r.best_at),
      startedAt: Number(r.started_at),
      completedAt: r.completed_at === null ? null : Number(r.completed_at),
    };
  }

  /** 1 文字ぶんの追加・状態更新・古い文字の削除を 1 トランザクションで行う。 */
  async commitTick(row: CharRow, s: State): Promise<void> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("INSERT INTO imt_chars (id, ch, ts) VALUES (?,?,?)", [row.id, row.ch, row.ts]);
      await conn.query("UPDATE imt_state SET total=?, cur_len=?, best_len=?, best_at=?, completed_at=? WHERE id=1", [
        s.total,
        s.cur,
        s.best,
        s.bestAt,
        s.completedAt,
      ]);
      await conn.query("DELETE FROM imt_chars WHERE id <= ?", [row.id - this.retain]);
      await conn.commit();
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }
  }

  /** 新しい順に最大 limit 文字。before を渡すとその id より古いもの。 */
  async recent(limit: number, before?: number): Promise<CharRow[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      before === undefined
        ? "SELECT id, ch, ts FROM imt_chars ORDER BY id DESC LIMIT ?"
        : "SELECT id, ch, ts FROM imt_chars WHERE id < ? ORDER BY id DESC LIMIT ?",
      before === undefined ? [limit] : [before, limit],
    );
    return rows.map((r) => ({ id: Number(r.id), ch: String(r.ch), ts: Number(r.ts) }));
  }

  async count(): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM imt_chars");
    return Number(rows[0]!.n);
  }

  async close(): Promise<void> {
    await this.lockConn?.end().catch(() => {});
    await this.pool.end().catch(() => {});
  }
}
