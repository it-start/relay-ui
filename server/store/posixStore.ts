import path from 'path';
import fs from 'fs';
import { 
  IRelayStore, 
  Envelope, 
  RelayRecord, 
  RelayStoreStatus, 
  DepositInput, 
  InboxMessageInput, 
  InboxMessage, 
  VerifyDigestResult, 
  DeletePayloadResult 
} from './types';
import { canonicalJson, sha256 } from './canonical';

export interface PosixStoreHooks {
  onDeposit?: (envelope: Envelope) => void;
  onKnownMissing?: (locator: string) => void;
  onReset?: () => void;
  onInboxMessage?: (targetAgent: string, msgId: string, envelope: InboxMessage) => void;
}

/**
 * Reference POSIX Relay Store Implementation
 * 
 * Uses atomic O_CREAT | O_EXCL file markers in history/ to guarantee
 * conflict-free, lockless monotonic sequence allocation and soft-delete retention (SPEC MUST 1-8).
 */
export class PosixRelayStore implements IRelayStore {
  readonly id = 'posix-o-excl-store';
  readonly storeRoot: string;
  private dirs: {
    history: string;
    records: string;
    inboxClaude: string;
    inboxChatGPT: string;
    inboxGemini: string;
    inboxCourt: string;
    outbox: string;
  };
  private hooks: PosixStoreHooks;

  constructor(storeRoot: string = path.resolve(process.cwd(), '.relay_store'), hooks: PosixStoreHooks = {}) {
    this.storeRoot = storeRoot;
    this.hooks = hooks;
    this.dirs = {
      history: path.join(this.storeRoot, 'history'),
      records: path.join(this.storeRoot, 'records'),
      inboxClaude: path.join(this.storeRoot, 'inbox', 'claude'),
      inboxChatGPT: path.join(this.storeRoot, 'inbox', 'chatgpt'),
      inboxGemini: path.join(this.storeRoot, 'inbox', 'gemini'),
      inboxCourt: path.join(this.storeRoot, 'inbox', 'court'),
      outbox: path.join(this.storeRoot, 'outbox'),
    };
  }

  init(): void {
    Object.values(this.dirs).forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Seed with initial genesis consensus records if empty
    const recordFiles = fs.readdirSync(this.dirs.records);
    if (recordFiles.length === 0) {
      this.seedGenesisRecords();
    }
  }

  private seedGenesisRecords(): void {
    const seeds: DepositInput[] = [
      {
        from: 'agent:claude-code-cli',
        to: 'all',
        type: 'claim',
        title: 'Инициализация протокола SPEC v1',
        payload: {
          proposal: 'SPEC v1: Обязательные инварианты MUST 1-8 для детерминированного судилища агентов',
          invariants: ['MUST 1: O_EXCL маркеры', 'MUST 3: Канонические весы Prov 11:1', 'MUST 6: Known Missing при удалении'],
          author: 'Claude Code CLI',
          version: '1.0.0'
        }
      },
      {
        from: 'agent:gemini-criterion-guard',
        to: 'all',
        type: 'finding',
        title: 'Проверка канонических инвариантов SPEC v1',
        payload: {
          verdict: 'PASS',
          confidence: 1.0,
          biblical_principle: 'Proverbs 11:1 - Неверные весы — мерзость перед Господом, но правильный вес угоден Ему',
          reasoning: 'Инварианты SPEC v1 обеспечивают строго монотонную последовательность и защиту от гонок перепривязки.'
        }
      }
    ];

    seeds.forEach((seed) => this.deposit(seed));
  }

  getStatus(): RelayStoreStatus {
    const historyFiles = fs.existsSync(this.dirs.history) ? fs.readdirSync(this.dirs.history) : [];
    const recordFiles = fs.existsSync(this.dirs.records) 
      ? fs.readdirSync(this.dirs.records).filter(f => f.endsWith('.json')) 
      : [];

    const getInboxCount = (dir: string) => {
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).length : 0;
    };

    return {
      status: 'online',
      storeType: this.id,
      storeRoot: this.storeRoot,
      totalSequencesAllocated: historyFiles.length,
      presentRecordsCount: recordFiles.length,
      knownMissingCount: Math.max(0, historyFiles.length - recordFiles.length),
      inboxes: {
        claude: getInboxCount(this.dirs.inboxClaude),
        chatgpt: getInboxCount(this.dirs.inboxChatGPT),
        gemini: getInboxCount(this.dirs.inboxGemini),
        court: getInboxCount(this.dirs.inboxCourt),
      }
    };
  }

  allocateSequence(): { seq: number; locator: string } {
    let seq = 1;
    while (true) {
      const locator = `relay-${String(seq).padStart(4, '0')}`;
      const markerPath = path.join(this.dirs.history, locator);
      try {
        const fd = fs.openSync(
          markerPath,
          fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
          0o644
        );
        fs.closeSync(fd);
        return { seq, locator };
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          seq++;
          continue;
        }
        throw err;
      }
    }
  }

  deposit(data: DepositInput): Envelope {
    const { seq, locator } = this.allocateSequence();
    const canPayload = canonicalJson(data.payload || {});
    const digest = `sha256:${sha256(canPayload)}`;
    const timestamp = new Date().toISOString();

    const envelope: Envelope = {
      id: `env-${Date.now()}-${seq}`,
      seq,
      locator,
      store_id: 'store:local-hub-01',
      digest,
      type: data.type || 'claim',
      title: data.title || `Record ${locator}`,
      from: data.from || 'agent:anonymous',
      to: data.to || 'all',
      parent_locator: data.parent_locator || null,
      header_block: {
        deposited_by: data.from || 'agent:anonymous',
        timestamp,
        seq,
        locator,
        digest
      },
      payload: data.payload || {},
      metadata: data.metadata || {},
      status: 'committed',
      timestamp
    };

    const targetFile = path.join(this.dirs.records, `${locator}.json`);
    const tempFile = path.join(this.dirs.records, `${locator}.tmp.${process.pid}.${Date.now()}`);

    fs.writeFileSync(tempFile, JSON.stringify(envelope, null, 2), 'utf-8');
    fs.renameSync(tempFile, targetFile);

    if (this.hooks.onDeposit) {
      this.hooks.onDeposit(envelope);
    }

    return envelope;
  }

  getAllRecords(limit?: number): RelayRecord[] {
    if (!fs.existsSync(this.dirs.history)) {
      return [];
    }

    const markers = fs.readdirSync(this.dirs.history).sort();
    const records: RelayRecord[] = markers.map((marker) => {
      const recordPath = path.join(this.dirs.records, `${marker}.json`);
      if (fs.existsSync(recordPath)) {
        try {
          const content = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
          return {
            locator: marker,
            status: 'PRESENT',
            envelope: content,
          };
        } catch (e: any) {
          return {
            locator: marker,
            status: 'CORRUPTED',
            envelope: null,
            error: 'Invalid JSON payload'
          };
        }
      } else {
        return {
          locator: marker,
          status: 'KNOWN_MISSING',
          envelope: null,
          note: 'Payload unlinked, monotonic marker preserved (SPEC MUST 6)'
        };
      }
    });

    return limit ? records.slice(-limit) : records;
  }

  getRecord(locator: string): RelayRecord | null {
    const markerFile = path.join(this.dirs.history, locator);
    if (!fs.existsSync(markerFile)) {
      return null;
    }

    const recordFile = path.join(this.dirs.records, `${locator}.json`);
    if (fs.existsSync(recordFile)) {
      try {
        const content = JSON.parse(fs.readFileSync(recordFile, 'utf-8'));
        return {
          locator,
          status: 'PRESENT',
          envelope: content
        };
      } catch (e: any) {
        return {
          locator,
          status: 'CORRUPTED',
          envelope: null,
          error: 'Invalid JSON payload'
        };
      }
    }

    return {
      locator,
      status: 'KNOWN_MISSING',
      envelope: null,
      note: 'Payload unlinked, monotonic marker preserved (SPEC MUST 6)'
    };
  }

  deletePayload(locator: string): DeletePayloadResult {
    const recordFile = path.join(this.dirs.records, `${locator}.json`);
    const markerFile = path.join(this.dirs.history, locator);

    if (!fs.existsSync(markerFile)) {
      return {
        success: false,
        locator,
        status: 'NOT_FOUND',
        message: `Sequence marker ${locator} does not exist.`
      };
    }

    if (fs.existsSync(recordFile)) {
      fs.unlinkSync(recordFile);
      if (this.hooks.onKnownMissing) {
        this.hooks.onKnownMissing(locator);
      }
      return {
        success: true,
        locator,
        status: 'KNOWN_MISSING',
        message: `Payload for ${locator} removed. History marker retained to guarantee monotonic ordering (SPEC MUST 6).`
      };
    }

    return {
      success: true,
      locator,
      status: 'ALREADY_MISSING',
      message: `${locator} was already missing its payload.`
    };
  }

  verifyDigest(locator: string): VerifyDigestResult | null {
    const recordFile = path.join(this.dirs.records, `${locator}.json`);
    if (!fs.existsSync(recordFile)) {
      return null;
    }

    try {
      const content = JSON.parse(fs.readFileSync(recordFile, 'utf-8'));
      const canPayload = canonicalJson(content.payload || {});
      const computedDigest = `sha256:${sha256(canPayload)}`;
      const headerDigest = content.digest || '';

      return {
        locator,
        valid: computedDigest === headerDigest,
        headerDigest,
        computedDigest,
        canonicalPayloadString: canPayload
      };
    } catch {
      return null;
    }
  }

  sendToInbox(agent: string, message: InboxMessageInput): InboxMessage {
    let targetDir = this.dirs.inboxGemini;
    if (agent === 'claude') targetDir = this.dirs.inboxClaude;
    else if (agent === 'chatgpt') targetDir = this.dirs.inboxChatGPT;
    else if (agent === 'court') targetDir = this.dirs.inboxCourt;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const msgId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const envelope: InboxMessage = {
      id: msgId,
      from: message.from || 'agent:anonymous',
      to: agent,
      type: message.type || 'claim',
      title: message.title || 'Direct Inbox Message',
      payload: message.payload || {},
      timestamp: new Date().toISOString()
    };

    const filePath = path.join(targetDir, `${msgId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf-8');

    if (this.hooks.onInboxMessage) {
      this.hooks.onInboxMessage(agent, msgId, envelope);
    }

    return envelope;
  }

  getInbox(agent: string): InboxMessage[] {
    let targetDir = this.dirs.inboxGemini;
    if (agent === 'claude') targetDir = this.dirs.inboxClaude;
    else if (agent === 'chatgpt') targetDir = this.dirs.inboxChatGPT;
    else if (agent === 'court') targetDir = this.dirs.inboxCourt;

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const files = fs.readdirSync(targetDir).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      const content = JSON.parse(fs.readFileSync(path.join(targetDir, f), 'utf-8'));
      return { file: f, ...content };
    });
  }

  reset(): void {
    Object.values(this.dirs).forEach((dir) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach((f) => {
          try {
            fs.unlinkSync(path.join(dir, f));
          } catch (e) {}
        });
      }
    });

    this.seedGenesisRecords();

    if (this.hooks.onReset) {
      this.hooks.onReset();
    }
  }
}
