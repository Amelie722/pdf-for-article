// 로컬 데이터베이스 (SQLite, sql.js 사용).
// 스키마 변경은 MIGRATIONS 배열 끝에 추가한다. 이미 적용된 항목은 수정하지 않는다.
import initSqlJs, { Database, SqlValue } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MIGRATIONS: string[] = [
  // v1: 문서, 주석
  `CREATE TABLE documents (
     id TEXT PRIMARY KEY,
     path TEXT NOT NULL,
     file_name TEXT NOT NULL,
     added_at TEXT NOT NULL,
     last_opened_at TEXT NOT NULL
   );
   CREATE TABLE annotations (
     id TEXT PRIMARY KEY,
     doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     page INTEGER NOT NULL,
     kind TEXT NOT NULL,
     color TEXT NOT NULL,
     text TEXT NOT NULL,
     note TEXT NOT NULL DEFAULT '',
     rects TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX idx_annotations_doc ON annotations(doc_id, page);`,
];

export class Db {
  private saveTimer: NodeJS.Timeout | null = null;

  private constructor(private readonly db: Database, private readonly file: string) {}

  static async open(file: string): Promise<Db> {
    const SQL = await initSqlJs({ locateFile: (f: string) => join(__dirname, f) });
    const db = existsSync(file) ? new SQL.Database(readFileSync(file)) : new SQL.Database();
    db.exec('PRAGMA foreign_keys = ON;');
    const instance = new Db(db, file);
    instance.migrate();
    return instance;
  }

  private migrate(): void {
    const current = Number(this.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0);
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.db.exec('BEGIN;');
      this.db.exec(MIGRATIONS[v]);
      this.db.exec(`PRAGMA user_version = ${v + 1};`);
      this.db.exec('COMMIT;');
    }
    if (current < MIGRATIONS.length) this.saveNow();
  }

  all<T>(sql: string, params: SqlValue[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  get<T>(sql: string, params: SqlValue[] = []): T | undefined {
    return this.all<T>(sql, params)[0];
  }

  run(sql: string, params: SqlValue[] = []): void {
    this.db.run(sql, params);
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 300);
  }

  /** 임시 파일에 쓰고 바꿔치기해서, 저장 중 꺼져도 기존 파일이 깨지지 않게 한다. */
  saveNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, Buffer.from(this.db.export()));
    renameSync(tmp, this.file);
  }
}
