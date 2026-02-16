import { open } from 'lmdb';
import type { RootDatabase, Database } from 'lmdb';

export class DbConnection {
  private rootDb: RootDatabase;

  constructor(path: string) {
    this.rootDb = open({ path, maxDbs: 10 });
  }

  get root(): RootDatabase {
    return this.rootDb;
  }

  table<V>(name: string): Database<V, string> {
    return this.rootDb.openDB<V, string>({ name, encoding: 'msgpack' });
  }

  async close(): Promise<void> {
    await this.rootDb.close();
  }
}
