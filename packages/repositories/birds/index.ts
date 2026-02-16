import type { Database } from 'lmdb';
import type { Bird } from '@workhero/db';
import type { DbConnection } from '@workhero/db';

export class BirdRepository {
  private birds: Database<Bird, string>;
  private nameIndex: Database<string, string>;

  constructor(private readonly db: DbConnection) {
    this.birds = db.table<Bird>('birds');
    this.nameIndex = db.table<string>('birds-name-index');
  }

  async create(bird: Bird): Promise<Bird> {
    await this.db.root.transaction(() => {
      this.birds.put(bird.id, bird);
      this.nameIndex.put(bird.name, bird.id);
    });

    return bird;
  }

  findById(id: string): Bird | undefined {
    return this.birds.get(id);
  }

  findByName(name: string): Bird | undefined {
    const birdId = this.nameIndex.get(name);
    if (!birdId) return undefined;
    return this.birds.get(birdId);
  }

  async updateStatus(
    id: string,
    status: Bird['status'],
  ): Promise<Bird | undefined> {
    const existing = this.birds.get(id);
    if (!existing) return undefined;

    const updated: Bird = { ...existing, status };
    await this.birds.put(id, updated);
    return updated;
  }
}
