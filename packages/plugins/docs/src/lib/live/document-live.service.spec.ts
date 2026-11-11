import { AsyncLocalStorage } from 'node:async_hooks';
import { NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { DocumentKindEnum } from '@gauzy/contracts';
import { GraphqlPubSub, RequestContext } from '@gauzy/core';
import { DocumentLiveBridge } from '../services/document-live.bridge';
import {
	DocumentLiveReasonEnum,
	DOCS_LIVE_READ_ONLY,
	DOCS_LIVE_SESSION_NOT_FOUND,
	DOCS_LIVE_UPDATE_INVALID,
	DOCS_LIVE_USER_LIMIT
} from './docs-live.config';
import { DocumentLiveService } from './document-live.service';
import { IDocumentLiveFrame } from './document-live.types';
import {
	decodeLiveState,
	encodeLiveState,
	LIVE_FRAGMENT,
	liveDocumentJson,
	normaliseNode,
	serverWriteChange
} from './document-live.yjs';

/** Who the code under test runs as: the stand-in of the request context, kept in an AsyncLocalStorage as nestjs-cls does. */
const who = new AsyncLocalStorage<{ userId: string; tenantId: string; organizationId: string }>();
const as = <T>(userId: string, run: () => T): T =>
	who.run({ userId, tenantId: 'tenant-1', organizationId: 'org-1' }, run);

jest.spyOn(RequestContext, 'currentUserId').mockImplementation(() => (who.getStore()?.userId ?? null) as never);
jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => (who.getStore()?.tenantId ?? null) as never);
jest.spyOn(RequestContext, 'currentOrganizationId').mockImplementation(
	() => (who.getStore()?.organizationId ?? null) as never
);

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

interface IRow {
	id: string;
	tenantId: string;
	organizationId: string;
	kind: DocumentKindEnum;
	contentJson: unknown;
	contentBinary: Buffer | null;
	contentRevision: number;
	updatedAt: Date;
	isLocked: boolean;
	deletedAt: Date | null;
	readers: Set<string>;
	writers: Set<string>;
}

/** The Documents service as far as the live sessions use it, over one shared table. */
class Table {
	readonly rows = new Map<string, IRow>();
	readonly saves: Array<{ userId: string | undefined; revision: number; json: unknown }> = [];
	/** How many saves fail before they work again. */
	failSaves = 0;

	add(id: string, content: unknown[], access: { readers: string[]; writers: string[] }): IRow {
		const row: IRow = {
			id,
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			kind: DocumentKindEnum.PAGE,
			contentJson: { type: 'doc', content },
			contentBinary: null,
			contentRevision: 1,
			updatedAt: new Date('2026-11-11T00:00:00Z'),
			isLocked: false,
			deletedAt: null,
			readers: new Set(access.readers),
			writers: new Set(access.writers)
		};
		this.rows.set(id, row);
		return row;
	}

	service(): never {
		const table = this;
		const matches = (row: IRow, where: Record<string, unknown>) =>
			Object.entries(where).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value);
		return {
			async findOneScoped(id: string) {
				const row = table.rows.get(id);
				if (!row || row.deletedAt || !row.readers.has(String(RequestContext.currentUserId()))) {
					throw new NotFoundException();
				}
				return { ...row };
			},
			async canRead(row: IRow) {
				return table.rows.get(row.id)?.readers.has(String(RequestContext.currentUserId())) ?? false;
			},
			async assertCanWrite(row: IRow) {
				if (!table.rows.get(row.id)?.writers.has(String(RequestContext.currentUserId()))) {
					throw new Error('forbidden');
				}
			},
			async saveLiveContent(
				row: IRow,
				input: { contentJson: unknown; contentBinary: Buffer; contentRevision: number }
			) {
				if (table.failSaves > 0) {
					table.failSaves -= 1;
					throw new Error('the database is away');
				}
				const stored = table.rows.get(row.id)!;
				stored.contentJson = input.contentJson;
				stored.contentBinary = input.contentBinary;
				stored.contentRevision = input.contentRevision;
				stored.updatedAt = new Date(stored.updatedAt.getTime() + 1);
				table.saves.push({
					userId: who.getStore()?.userId,
					revision: input.contentRevision,
					json: input.contentJson
				});
				return { ...stored };
			},
			typeOrmDocumentRepository: {
				async findOne({ where }: { where: Record<string, unknown> }) {
					const row = table.rows.get(String(where.id));
					return row && matches(row, { tenantId: where.tenantId }) ? { ...row } : null;
				},
				async update(where: Record<string, unknown>, values: Partial<IRow>) {
					const row = table.rows.get(String(where.id));
					if (!row || !matches(row, where)) {
						return { affected: 0 };
					}
					Object.assign(row, values);
					return { affected: 1 };
				}
			}
		} as never;
	}

	/** A content write that did not come through a live session (an API save): the row only. */
	writeOutside(id: string, content: unknown[]): { previous: IRow; updated: IRow } {
		const row = this.rows.get(id)!;
		const previous = { ...row };
		row.contentJson = { type: 'doc', content };
		row.contentRevision += 1;
		row.updatedAt = new Date(row.updatedAt.getTime() + 1);
		return { previous, updated: { ...row } };
	}
}

/** One editor: a Yjs document fed by the session's frames. */
class Editor {
	readonly doc = new Y.Doc();
	readonly frames: IDocumentLiveFrame[] = [];
	private stream?: AsyncIterableIterator<IDocumentLiveFrame>;
	private reading?: Promise<void>;

	constructor(
		readonly userId: string,
		readonly connectionId: string
	) {}

	async open(service: DocumentLiveService, documentId: string): Promise<IDocumentLiveFrame> {
		this.stream = await as(this.userId, () => service.open(documentId, this.connectionId));
		const first = await this.stream.next();
		this.take(first.value);
		const stream = this.stream;
		this.reading = (async () => {
			for await (const frame of stream) {
				this.take(frame);
			}
		})();
		return first.value;
	}

	/** Types at the end of the first paragraph and sends the edit. */
	async type(service: DocumentLiveService, documentId: string, text: string, block = 0): Promise<unknown> {
		const before = Y.encodeStateVector(this.doc);
		const element = this.doc.getXmlFragment(LIVE_FRAGMENT).get(block) as Y.XmlElement;
		const node = element.get(0) as Y.XmlText;
		node.insert(node.length, text);
		const update = Buffer.from(Y.encodeStateAsUpdate(this.doc, before)).toString('base64');
		return as(this.userId, () => service.applyClientUpdate(documentId, this.connectionId, update));
	}

	text(): unknown {
		return liveDocumentJson(this.doc);
	}

	async close(): Promise<void> {
		await this.stream?.return?.();
		await this.reading;
	}

	private take(frame: IDocumentLiveFrame): void {
		this.frames.push(frame);
		if (frame.update) {
			Y.applyUpdate(this.doc, Buffer.from(frame.update, 'base64'), 'server');
		}
	}
}

/** A pub/sub shared by several "processes", as Redis is. */
function sharedEngine() {
	const hub = new GraphqlPubSub();
	return {
		shared: true,
		publish: (topic: string, payload: unknown) =>
			(hub as never as { engine: { publish(t: string, p: unknown): void } }).engine.publish(
				topic,
				JSON.parse(JSON.stringify(payload))
			),
		asyncIterableIterator: <T>(topic: string) => hub.asyncIterableIterator<T>(topic)
	};
}

const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check: () => boolean, ms = 3000): Promise<void> {
	const deadline = Date.now() + ms;
	while (!check()) {
		if (Date.now() > deadline) {
			throw new Error('timed out');
		}
		await settle(5);
	}
}

describe('DocumentLiveService', () => {
	const services: DocumentLiveService[] = [];
	let table: Table;
	let events: Subject<unknown>;

	beforeAll(() => {
		process.env.GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS = '20';
		process.env.GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS = '200';
	});

	afterAll(() => {
		delete process.env.GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS;
		delete process.env.GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS;
		delete process.env.GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE;
	});

	beforeEach(() => {
		table = new Table();
		events = new Subject();
	});

	afterEach(async () => {
		for (const service of services.splice(0)) {
			await service.onModuleDestroy();
		}
	});

	function process_(
		pubSub: GraphqlPubSub = new GraphqlPubSub(),
		bridge = new DocumentLiveBridge()
	): DocumentLiveService {
		const service = new DocumentLiveService(table.service(), bridge, pubSub, {
			ofType: () => events.asObservable()
		} as never);
		service.onModuleInit();
		services.push(service);
		return service;
	}

	/** A process whose saves wait (100 s): only a flush or the last session's close saves. */
	function slowSaving(): DocumentLiveService {
		process.env.GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS = '100000';
		process.env.GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS = '100000';
		try {
			return process_();
		} finally {
			process.env.GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS = '20';
			process.env.GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS = '200';
		}
	}

	it('lets two editors co-edit a page and saves what they wrote, as the last of them', async () => {
		table.add('page-1', [paragraph('Hello'), paragraph('World')], {
			readers: ['ann', 'bob'],
			writers: ['ann', 'bob']
		});
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		const bob = new Editor('bob', 'tab-bob-0001');

		const sync = await ann.open(service, 'page-1');
		await bob.open(service, 'page-1');

		expect(sync).toMatchObject({ kind: 'sync', readOnly: false, reason: null, revision: 1, lineage: 'page-1:1' });
		// The seed is stored at once, so another process opening the page loads the same lineage.
		expect(decodeLiveState(table.rows.get('page-1')!.contentBinary)?.meta).toEqual({
			lineage: 'page-1:1',
			revision: 1
		});

		await ann.type(service, 'page-1', ', there');
		await bob.type(service, 'page-1', '!', 1);
		await until(
			() => JSON.stringify(ann.text()).includes('World!') && JSON.stringify(bob.text()).includes('there')
		);

		const expected = normaliseNode({
			type: 'doc',
			content: [paragraph('Hello, there'), paragraph('World!')]
		} as never);
		expect(ann.text()).toEqual(expected);
		expect(bob.text()).toEqual(expected);

		await until(() => table.saves.length > 0);
		const row = table.rows.get('page-1')!;
		expect(normaliseNode(row.contentJson as never)).toEqual(expected);
		expect(row.contentRevision).toBe(2);
		expect(decodeLiveState(row.contentBinary)?.meta).toEqual({ lineage: 'page-1:1', revision: 2 });
		// Saved in the request context of the editor whose edit came last.
		expect(table.saves[table.saves.length - 1].userId).toBe('bob');

		await ann.close();
		await bob.close();
	});

	it('merges what an editor wrote while it was offline when it reconnects', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');
		await ann.close();

		// Offline: Ann types into her copy while Bob edits live.
		const text = (ann.doc.getXmlFragment(LIVE_FRAGMENT).get(0) as Y.XmlElement).get(0) as Y.XmlText;
		text.insert(0, 'Offline. ');
		const bob = new Editor('bob', 'tab-bob-0001');
		await bob.open(service, 'page-1');
		await bob.type(service, 'page-1', ' live');

		// Reconnect: the sync frame's state vector says what the server lacks.
		const again = new Editor('ann', 'tab-ann-0001');
		Y.applyUpdate(again.doc, Y.encodeStateAsUpdate(ann.doc));
		const sync = await again.open(service, 'page-1');
		const missing = Buffer.from(
			Y.encodeStateAsUpdate(again.doc, Buffer.from(sync.stateVector!, 'base64'))
		).toString('base64');
		await as('ann', () => service.applyClientUpdate('page-1', 'tab-ann-0001', missing));

		await until(() => JSON.stringify(bob.text()).includes('Offline'));
		expect(bob.text()).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Offline. Hello live')] } as never)
		);
		expect(again.text()).toEqual(bob.text());

		await again.close();
		await bob.close();
	});

	it('opens a page read-only without write access, and refuses its edits', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'viv'], writers: ['ann'] });
		const service = process_();
		const viv = new Editor('viv', 'tab-viv-0001');

		const sync = await viv.open(service, 'page-1');

		expect(sync).toMatchObject({ readOnly: true, reason: DocumentLiveReasonEnum.NO_WRITE_ACCESS });
		await expect(viv.type(service, 'page-1', '!')).rejects.toMatchObject({
			response: { code: DOCS_LIVE_READ_ONLY }
		});
		// Control: a page the caller cannot read is no session at all.
		await expect(as('eve', () => service.open('page-1', 'tab-eve-0001'))).rejects.toBeInstanceOf(NotFoundException);

		await viv.close();
	});

	it('turns sessions read-only when the page is locked, and closes them when access is revoked or the page trashed', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		const bob = new Editor('bob', 'tab-bob-0001');
		await ann.open(service, 'page-1');
		await bob.open(service, 'page-1');

		table.rows.get('page-1')!.isLocked = true;
		events.next({ entity: { id: 'page-1' } });
		await until(() => ann.frames.some((frame) => frame.kind === 'mode'));
		expect(ann.frames.find((frame) => frame.kind === 'mode')).toMatchObject({
			readOnly: true,
			reason: DocumentLiveReasonEnum.LOCKED
		});

		table.rows.get('page-1')!.isLocked = false;
		table.rows.get('page-1')!.readers.delete('bob');
		as('ann', () => service.accessChanged('page-1' as never));
		await until(() => bob.frames.some((frame) => frame.kind === 'closed'));
		expect(bob.frames[bob.frames.length - 1]).toMatchObject({
			kind: 'closed',
			reason: DocumentLiveReasonEnum.ACCESS_REVOKED
		});
		await until(() => ann.frames.filter((frame) => frame.kind === 'mode').length === 2);
		expect(ann.frames.filter((frame) => frame.kind === 'mode')[1]).toMatchObject({ readOnly: false, reason: null });

		table.rows.get('page-1')!.deletedAt = new Date();
		events.next({ entity: { id: 'page-1' } });
		await until(() => ann.frames.some((frame) => frame.kind === 'closed'));
		expect(ann.frames[ann.frames.length - 1]).toMatchObject({
			kind: 'closed',
			reason: DocumentLiveReasonEnum.TRASHED
		});

		await ann.close();
		await bob.close();
	});

	it('opens read-only past the page editor limit', async () => {
		process.env.GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE = '1';
		try {
			table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
			const service = process_();
			const ann = new Editor('ann', 'tab-ann-0001');
			const bob = new Editor('bob', 'tab-bob-0001');

			expect(await ann.open(service, 'page-1')).toMatchObject({ readOnly: false });
			expect(await bob.open(service, 'page-1')).toMatchObject({
				readOnly: true,
				reason: DocumentLiveReasonEnum.SESSION_LIMIT
			});

			await ann.close();
			await bob.close();
		} finally {
			delete process.env.GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_PAGE;
		}
	});

	it('shows a server-side write to open editors, keeping what they typed elsewhere', async () => {
		table.add('page-1', [paragraph('Intro'), paragraph('Plan: Friday')], { readers: ['ann'], writers: ['ann'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');
		await ann.type(service, 'page-1', ' (draft)');
		await until(() => table.saves.length === 1);

		// An API client rewrites the second paragraph (a Markdown update): the row first, then the bridge.
		const { previous, updated } = table.writeOutside('page-1', [
			paragraph('Intro (draft)'),
			paragraph('Plan: Monday')
		]);
		await as('api', () => service.contentWritten(previous as never, updated as never));

		await until(() => JSON.stringify(ann.text()).includes('Monday'));
		expect(ann.text()).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Intro (draft)'), paragraph('Plan: Monday')] } as never)
		);
		// The state is stored for the write's revision, so the next persist does not mistake it for an outside write.
		expect(decodeLiveState(table.rows.get('page-1')!.contentBinary)?.meta.revision).toBe(updated.contentRevision);

		await ann.type(service, 'page-1', '!', 1);
		await until(() => table.saves.length === 2);
		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Intro (draft)'), paragraph('Plan: Monday!')] } as never)
		);

		await ann.close();
	});

	it('applies a server-side write to the stored live state of a page no session of this process holds', async () => {
		table.add('page-1', [paragraph('One'), paragraph('Two')], { readers: ['ann'], writers: ['ann'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');
		await ann.close();
		await until(() => !service.status().documents);

		const { previous, updated } = table.writeOutside('page-1', [paragraph('One'), paragraph('Three')]);
		await as('api', () => service.contentWritten(previous as never, updated as never));

		const stored = decodeLiveState(table.rows.get('page-1')!.contentBinary)!;
		expect(stored.meta).toEqual({ lineage: 'page-1:1', revision: updated.contentRevision });
		expect(liveDocumentJson(stored.doc)).toEqual(normaliseNode(updated.contentJson as never));

		// Reopened, the page is the same lineage: an editor holding the old state merges instead of doubling it.
		const again = new Editor('ann', 'tab-ann-0002');
		Y.applyUpdate(again.doc, Y.encodeStateAsUpdate(ann.doc));
		const sync = await again.open(service, 'page-1');
		expect(sync.lineage).toBe('page-1:1');
		expect(again.text()).toEqual(normaliseNode(updated.contentJson as never));

		await again.close();
	});

	it('saves the live document before a copy reads it', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann'], writers: ['ann'] });
		process.env.GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS = '100000';
		process.env.GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS = '100000';
		const service = process_();
		process.env.GAUZY_DOCS_LIVE_PERSIST_DEBOUNCE_MS = '20';
		process.env.GAUZY_DOCS_LIVE_PERSIST_MAX_WAIT_MS = '200';
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');
		await ann.type(service, 'page-1', ' world');

		expect(table.saves).toHaveLength(0);
		await as('ann', () => service.flush('page-1' as never, 'tenant-1' as never));

		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Hello world')] } as never)
		);

		await ann.close();
	});

	it('tells the others when an editor leaves, and lets the page go after the last one', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		const bob = new Editor('bob', 'tab-bob-0001');
		await ann.open(service, 'page-1');
		await bob.open(service, 'page-1');

		const cursor = new Awareness(ann.doc);
		cursor.setLocalState({ user: { name: 'Ann' }, cursor: null });
		const update = Buffer.from(encodeAwarenessUpdate(cursor, [cursor.clientID])).toString('base64');
		await as('ann', () => service.applyClientAwareness('page-1', 'tab-ann-0001', update));
		await until(() => bob.frames.some((frame) => frame.kind === 'awareness'));
		const seen = new Awareness(new Y.Doc());
		applyAwarenessUpdate(
			seen,
			Buffer.from(bob.frames.find((frame) => frame.kind === 'awareness')!.awareness!, 'base64'),
			'test'
		);
		expect(seen.getStates().get(cursor.clientID)).toEqual({ user: { name: 'Ann' }, cursor: null });

		await ann.close();
		await until(() => bob.frames.filter((frame) => frame.kind === 'awareness').length === 2);
		applyAwarenessUpdate(
			seen,
			Buffer.from(bob.frames.filter((frame) => frame.kind === 'awareness')[1].awareness!, 'base64'),
			'test'
		);
		expect(seen.getStates().has(cursor.clientID)).toBe(false);

		await bob.close();
		await until(() => service.status().documents === 0);
		cursor.destroy();
		seen.destroy();
	});

	it('answers 404 for an edit of a session no process holds', async () => {
		const service = process_();

		await expect(
			as('ann', () => service.applyClientUpdate('page-1', 'tab-ann-0001', Buffer.from([0, 0]).toString('base64')))
		).rejects.toMatchObject({
			response: { code: DOCS_LIVE_SESSION_NOT_FOUND }
		});
	});

	it('keeps what an editor typed and has not saved yet in a block a server-side write did not change', async () => {
		table.add('page-1', [paragraph('Intro'), paragraph('Plan: Friday')], { readers: ['ann'], writers: ['ann'] });
		const service = slowSaving();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');
		await ann.type(service, 'page-1', ' (draft)');
		expect(table.saves).toHaveLength(0);

		// The write was made from the stored page, which does not have Ann's text yet.
		const { previous, updated } = table.writeOutside('page-1', [paragraph('Intro'), paragraph('Plan: Monday')]);
		await as('api', () => service.contentWritten(previous as never, updated as never));

		await until(() => JSON.stringify(ann.text()).includes('Monday'));
		const expected = normaliseNode({
			type: 'doc',
			content: [paragraph('Intro (draft)'), paragraph('Plan: Monday')]
		} as never);
		expect(ann.text()).toEqual(expected);

		await as('ann', () => service.flush('page-1' as never, 'tenant-1' as never));
		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(expected);

		await ann.close();
	});

	it('refuses an edit whose content the page schema does not accept, and applies nothing of it', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		const bob = new Editor('bob', 'tab-bob-0001');
		await ann.open(service, 'page-1');
		await bob.open(service, 'page-1');

		const before = Y.encodeStateVector(ann.doc);
		ann.doc.getXmlFragment(LIVE_FRAGMENT).insert(1, [new Y.XmlElement('notANode')]);
		const bad = Buffer.from(Y.encodeStateAsUpdate(ann.doc, before)).toString('base64');
		await expect(as('ann', () => service.applyClientUpdate('page-1', 'tab-ann-0001', bad))).rejects.toMatchObject({
			response: { code: DOCS_LIVE_UPDATE_INVALID }
		});

		// Bob never received it; a good edit from Bob still goes through.
		await bob.type(service, 'page-1', '!');
		await until(() => table.saves.length > 0);
		expect(bob.frames.filter((frame) => frame.kind === 'update')).toHaveLength(0);
		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Hello!')] } as never)
		);

		await ann.close();
		await bob.close();
	});

	it('lets a session write only the awareness of the editors it reported', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		const bob = new Editor('bob', 'tab-bob-0001');
		await ann.open(service, 'page-1');
		await bob.open(service, 'page-1');

		const cursor = new Awareness(ann.doc);
		cursor.setLocalState({ user: { name: 'Ann' } });
		const own = Buffer.from(encodeAwarenessUpdate(cursor, [cursor.clientID])).toString('base64');
		await as('ann', () => service.applyClientAwareness('page-1', 'tab-ann-0001', own));

		// Bob sends Ann's client id with a newer clock, as if he were her.
		cursor.setLocalState({ user: { name: 'Not Ann' } });
		const forged = Buffer.from(encodeAwarenessUpdate(cursor, [cursor.clientID])).toString('base64');
		await expect(
			as('bob', () => service.applyClientAwareness('page-1', 'tab-bob-0001', forged))
		).rejects.toMatchObject({
			response: { code: DOCS_LIVE_UPDATE_INVALID }
		});

		cursor.destroy();
		await ann.close();
		await bob.close();
	});

	it('counts only the caller tenant in the status', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann'], writers: ['ann'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');

		expect(as('ann', () => service.status())).toMatchObject({ documents: 1, sessions: 1 });
		expect(
			who.run({ userId: 'zed', tenantId: 'tenant-2', organizationId: 'org-9' }, () => service.status())
		).toMatchObject({
			documents: 0,
			sessions: 0
		});

		await ann.close();
	});

	it('lets a reconnecting tab replace its own session at the per-user limit', async () => {
		process.env.GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER = '1';
		try {
			table.add('page-1', [paragraph('Hello')], { readers: ['ann'], writers: ['ann'] });
			const service = process_();
			const first = new Editor('ann', 'tab-ann-0001');
			await first.open(service, 'page-1');

			const again = new Editor('ann', 'tab-ann-0001');
			expect(await again.open(service, 'page-1')).toMatchObject({ kind: 'sync' });
			expect(first.frames[first.frames.length - 1]).toMatchObject({
				kind: 'closed',
				reason: DocumentLiveReasonEnum.REPLACED
			});

			// Control: another tab is over the limit.
			await expect(as('ann', () => service.open('page-1', 'tab-ann-0002'))).rejects.toMatchObject({
				response: { code: DOCS_LIVE_USER_LIMIT }
			});

			await first.close();
			await again.close();
		} finally {
			delete process.env.GAUZY_DOCS_LIVE_MAX_SESSIONS_PER_USER;
		}
	});

	it('tries a failed save again, and keeps the page loaded until its edits are saved', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann'], writers: ['ann'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');
		table.failSaves = 1;
		await ann.type(service, 'page-1', ' world');
		await ann.close();

		// The first save failed; the page is still held, and the retry saves it.
		await settle(300);
		expect(as('ann', () => service.status()).documents).toBe(1);
		await until(() => table.saves.length === 1, 8000);
		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Hello world')] } as never)
		);
		await until(() => as('ann', () => service.status()).documents === 0);
	});

	it('keeps unsaved edits in the stored state when the process stops and cannot save, and saves them on the next open', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann'], writers: ['ann'] });
		const stopping = slowSaving();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(stopping, 'page-1');
		await ann.type(stopping, 'page-1', ' world');
		table.failSaves = 10;

		await stopping.onModuleDestroy();
		services.splice(services.indexOf(stopping), 1);
		expect(table.saves).toHaveLength(0);
		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Hello')] } as never)
		);

		// The next process loads the kept state, and its first editor saves it.
		table.failSaves = 0;
		const next = process_();
		const again = new Editor('ann', 'tab-ann-0002');
		await again.open(next, 'page-1');
		expect(again.text()).toEqual(normaliseNode({ type: 'doc', content: [paragraph('Hello world')] } as never));
		await until(() => table.saves.length === 1);
		expect(normaliseNode(table.rows.get('page-1')!.contentJson as never)).toEqual(
			normaliseNode({ type: 'doc', content: [paragraph('Hello world')] } as never)
		);

		await again.close();
	}, 20_000);

	it('refuses an awareness update it cannot read whole, and leaves the client id free', async () => {
		table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'bob'], writers: ['ann', 'bob'] });
		const service = process_();
		const ann = new Editor('ann', 'tab-ann-0001');
		const bob = new Editor('bob', 'tab-bob-0001');
		await ann.open(service, 'page-1');
		await bob.open(service, 'page-1');

		const cursor = new Awareness(bob.doc);
		cursor.setLocalState({ user: { name: 'Bob' } });
		const good = Buffer.from(encodeAwarenessUpdate(cursor, [cursor.clientID]));
		// The same entry with its state cut short: not JSON.
		const broken = Buffer.concat([good.subarray(0, good.length - 3), Buffer.from([0x7b, 0x7b, 0x7b])]);
		await expect(
			as('ann', () => service.applyClientAwareness('page-1', 'tab-ann-0001', broken.toString('base64')))
		).rejects.toMatchObject({
			response: { code: DOCS_LIVE_UPDATE_INVALID }
		});
		// Bob can still report his own id.
		await expect(
			as('bob', () => service.applyClientAwareness('page-1', 'tab-bob-0001', good.toString('base64')))
		).resolves.toMatchObject({
			accepted: true
		});

		cursor.destroy();
		await ann.close();
		await bob.close();
	});

	it('works a server-side write out against the stored state after another process moved the page', async () => {
		table.add('page-1', [paragraph('One'), paragraph('Two')], { readers: ['ann'], writers: ['ann'] });
		const service = slowSaving();
		const ann = new Editor('ann', 'tab-ann-0001');
		await ann.open(service, 'page-1');

		// Another process wrote the page (revision 2) and stored its state; this one heard nothing.
		const other = decodeLiveState(table.rows.get('page-1')!.contentBinary)!;
		const elsewhere = table.writeOutside('page-1', [paragraph('One'), paragraph('Two, elsewhere')]);
		const moved = serverWriteChange(Y.encodeStateAsUpdate(other.doc), elsewhere.updated.contentJson);
		table.rows.get('page-1')!.contentBinary = encodeLiveState(moved.state, {
			lineage: other.meta.lineage,
			revision: 2
		});
		other.doc.destroy();
		Y.applyUpdate(ann.doc, moved.change);
		await as('ann', () =>
			service.applyClientUpdate('page-1', 'tab-ann-0001', Buffer.from(moved.change).toString('base64'))
		);

		// Now an API write on this process, from revision 2: only its own change is applied.
		const { previous, updated } = table.writeOutside('page-1', [paragraph('Three'), paragraph('Two, elsewhere')]);
		await as('api', () => service.contentWritten(previous as never, updated as never));

		await until(() => JSON.stringify(ann.text()).includes('Three'));
		expect(ann.text()).toEqual(normaliseNode(updated.contentJson as never));

		await ann.close();
	});

	describe('with several API processes', () => {
		it('answers an edit handed to another process with what that process did', async () => {
			table.add('page-1', [paragraph('Hello')], { readers: ['ann', 'viv'], writers: ['ann'] });
			const engine = sharedEngine();
			const first = process_(new GraphqlPubSub(engine as never));
			const second = process_(new GraphqlPubSub(engine as never));
			const viv = new Editor('viv', 'tab-viv-0001');
			await viv.open(second, 'page-1');

			// Viv's session is read-only on the second process; her edit posted to the first gets that answer.
			await expect(viv.type(first, 'page-1', '!')).rejects.toMatchObject({
				response: { code: DOCS_LIVE_READ_ONLY }
			});
			// No process holds this connection: the 404 that sends the client to open its session again.
			await expect(
				as('viv', () =>
					first.applyClientUpdate('page-1', 'tab-viv-9999', Buffer.from([0, 0]).toString('base64'))
				)
			).rejects.toMatchObject({ response: { code: DOCS_LIVE_SESSION_NOT_FOUND } });

			await viv.close();
		});

		it('relays edits between them, hands an edit to the process that holds its session, and keeps one lineage', async () => {
			table.add('page-1', [paragraph('Hello'), paragraph('World')], {
				readers: ['ann', 'bob'],
				writers: ['ann', 'bob']
			});
			const engine = sharedEngine();
			const first = process_(new GraphqlPubSub(engine as never));
			const second = process_(new GraphqlPubSub(engine as never));
			const ann = new Editor('ann', 'tab-ann-0001');
			const bob = new Editor('bob', 'tab-bob-0001');

			const [annSync, bobSync] = await Promise.all([ann.open(first, 'page-1'), bob.open(second, 'page-1')]);
			expect(annSync.lineage).toBe(bobSync.lineage);

			await ann.type(first, 'page-1', ', there');
			// Bob's edit is posted to the process that does not hold his session.
			const ack = await bob.type(first, 'page-1', '!', 1);
			expect(ack).toEqual({ accepted: true, relayed: true });

			const expected = normaliseNode({
				type: 'doc',
				content: [paragraph('Hello, there'), paragraph('World!')]
			} as never);
			await until(
				() =>
					JSON.stringify(ann.text()) === JSON.stringify(expected) &&
					JSON.stringify(bob.text()) === JSON.stringify(expected)
			);

			await until(
				() =>
					table.saves.length > 0 &&
					JSON.stringify(normaliseNode(table.rows.get('page-1')!.contentJson as never)) ===
						JSON.stringify(expected)
			);

			await ann.close();
			await bob.close();
		});

		it('shows a server-side write made by a process that holds no session to the editors of another', async () => {
			table.add('page-1', [paragraph('One'), paragraph('Two')], { readers: ['ann'], writers: ['ann'] });
			const engine = sharedEngine();
			const holder = process_(new GraphqlPubSub(engine as never));
			const writer = process_(new GraphqlPubSub(engine as never));
			const ann = new Editor('ann', 'tab-ann-0001');
			await ann.open(holder, 'page-1');

			const { previous, updated } = table.writeOutside('page-1', [paragraph('One'), paragraph('Three')]);
			await as('api', () => writer.contentWritten(previous as never, updated as never));

			await until(() => JSON.stringify(ann.text()).includes('Three'));
			expect(ann.text()).toEqual(normaliseNode(updated.contentJson as never));

			await ann.close();
		});
	});
});
