/** What the driver's phone keeps besides its outbox: the last run Relay sent (the phone works from it with no
 *  signal), the proof drafts (still filled in if Android unloads the page while the camera is open), the phone's own
 *  id and when it last reached Relay. One small key and value store in IndexedDB; if the browser will not open it
 *  (a private window, say) every read comes back empty and the screens still work from memory. */
import Dexie, { type EntityTable } from "dexie";

type Item = { key: string; value: unknown; saved_at: number };

class PhoneDb extends Dexie {
  items!: EntityTable<Item, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ items: "key" });
  }
}

export class PhoneStore {
  private readonly db: PhoneDb;
  private device: Promise<string> | null = null;

  constructor(name = "relay-phone") {
    this.db = new PhoneDb(name);
  }

  async get<T>(key: string): Promise<{ value: T; saved_at: number } | undefined> {
    try {
      const item = await this.db.items.get(key);
      return item ? { value: item.value as T, saved_at: item.saved_at } : undefined;
    } catch {
      return undefined;
    }
  }

  async put(key: string, value: unknown): Promise<void> {
    try {
      await this.db.items.put({ key, value, saved_at: Date.now() });
    } catch {
      // nothing kept: the screen still has it in memory
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.db.items.delete(key);
    } catch {
      // already gone, or never kept
    }
  }

  /** Every key the test accepts, such as all the proof drafts. */
  async removeWhere(test: (key: string) => boolean): Promise<void> {
    try {
      await this.db.items.filter((item) => test(item.key)).delete();
    } catch {
      // nothing kept to let go of
    }
  }

  /** This phone's id, made once and kept, so the office can tell one device from another. */
  deviceId(): Promise<string> {
    if (!this.device) {
      this.device = this.get<string>("device").then(async (kept) => {
        if (kept?.value) return kept.value;
        const id = crypto.randomUUID();
        await this.put("device", id);
        return id;
      });
    }
    return this.device;
  }

  close() {
    this.db.close();
  }
}

export const phone = new PhoneStore();
