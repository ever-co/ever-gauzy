import { Subject } from 'rxjs';
import * as Y from 'yjs';
import { createLiveBinding, IDocumentLiveFrame, ILiveState } from './document-live.binding';

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/** The server's copy of the page, and the frames it would send. */
function serverPage(text: string) {
	const doc = new Y.Doc();
	const fragment = doc.getXmlFragment('default');
	const paragraph = new Y.XmlElement('paragraph');
	paragraph.insert(0, [new Y.XmlText(text)]);
	fragment.insert(0, [paragraph]);
	return {
		doc,
		sync: (overrides: Partial<IDocumentLiveFrame> = {}): IDocumentLiveFrame => ({
			kind: 'sync',
			documentId: 'page-1',
			update: b64(Y.encodeStateAsUpdate(doc)),
			stateVector: b64(Y.encodeStateVector(doc)),
			awareness: null,
			readOnly: false,
			reason: null,
			revision: 1,
			lineage: 'page-1:1',
			...overrides
		})
	};
}

function textOf(doc: Y.Doc): string {
	return doc
		.getXmlFragment('default')
		.toArray()
		.map((block) => ((block as Y.XmlElement).get(0) as Y.XmlText).toString())
		.join('\n');
}

describe('createLiveBinding', () => {
	let streams: Subject<IDocumentLiveFrame>[];
	let posted: string[];
	let states: ILiveState[];
	let timers: Array<{ fn: () => void; ms: number }>;
	let postUpdate: jest.Mock;

	const runTimers = async () => {
		while (timers.length) {
			timers.shift()!.fn();
			await Promise.resolve();
			await Promise.resolve();
		}
	};

	function bind() {
		streams = [];
		posted = [];
		states = [];
		timers = [];
		postUpdate = jest.fn(async (update: string) => {
			posted.push(update);
		});
		const binding = createLiveBinding({
			frames: () => {
				const stream = new Subject<IDocumentLiveFrame>();
				streams.push(stream);
				return stream.asObservable();
			},
			postUpdate,
			postAwareness: async () => undefined,
			user: { name: 'Ann', color: '#3366ff' },
			onState: (state) => states.push(state),
			batchMs: 50,
			setTimeout: (fn, ms) => {
				const timer = { fn, ms };
				timers.push(timer);
				return timer;
			},
			clearTimeout: (handle) => {
				timers = timers.filter((timer) => timer !== handle);
			}
		});
		binding.start();
		return binding;
	}

	it('fills the empty document from the sync frame and sends nothing the server already has', async () => {
		const server = serverPage('Hello');
		const binding = bind();

		streams[0].next(server.sync());
		await runTimers();

		expect(textOf(binding.doc)).toBe('Hello');
		expect(states[states.length - 1]).toMatchObject({ phase: 'live', readOnly: false });
		expect(posted).toHaveLength(0);
		binding.destroy();
	});

	it('sends after the sync what the server lacks: edits made while the socket was down', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();

		// The socket drops; the editor keeps typing; a new session opens on the same page.
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;
		binding.start();
		text.insert(5, ' offline');
		streams[1].next(server.sync());
		await runTimers();

		Y.applyUpdate(server.doc, Buffer.from(posted[posted.length - 1], 'base64'));
		expect(textOf(server.doc)).toBe('Hello offline');
		binding.destroy();
	});

	it('batches local edits into one update', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();

		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;
		text.insert(5, ',');
		text.insert(6, ' world');
		expect(timers.filter((timer) => timer.ms === 50)).toHaveLength(1);
		await runTimers();

		expect(postUpdate).toHaveBeenCalledTimes(1);
		Y.applyUpdate(server.doc, Buffer.from(posted[0], 'base64'));
		expect(textOf(server.doc)).toBe('Hello, world');
		binding.destroy();
	});

	it('applies the others’ edits without sending them back', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();

		const before = Y.encodeStateVector(server.doc);
		((server.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(5, '!');
		streams[0].next({
			kind: 'update',
			documentId: 'page-1',
			update: b64(Y.encodeStateAsUpdate(server.doc, before))
		});
		await runTimers();

		expect(textOf(binding.doc)).toBe('Hello!');
		expect(posted).toHaveLength(0);
		binding.destroy();
	});

	it('follows the server on read-only and on a closed session', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync({ readOnly: true, reason: 'no_write_access' }));
		expect(states[states.length - 1]).toMatchObject({ phase: 'live', readOnly: true, reason: 'no_write_access' });

		streams[0].next({ kind: 'mode', documentId: 'page-1', readOnly: false, reason: null });
		expect(states[states.length - 1]).toMatchObject({ readOnly: false });

		streams[0].next({ kind: 'closed', documentId: 'page-1', reason: 'access_revoked' });
		expect(states[states.length - 1]).toMatchObject({ phase: 'ended', reason: 'access_revoked' });
		binding.destroy();
	});

	it('ends when the page comes back with another lineage, so the editor starts again', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());

		binding.start();
		streams[1].next(server.sync({ lineage: 'page-1:7' }));

		expect(states[states.length - 1]).toMatchObject({ phase: 'ended', reason: 'lineage' });
		binding.destroy();
	});

	it('ends as unavailable when the socket cannot serve the session', () => {
		const binding = bind();

		streams[0].error(new Error('no socket'));

		expect(states[states.length - 1]).toMatchObject({ phase: 'ended', reason: 'unavailable' });
		binding.destroy();
	});

	it('sends the waiting edits when asked before leaving, and says so', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;

		text.insert(5, '!');
		expect(binding.hasPending()).toBe(true);
		await expect(binding.flush(1000)).resolves.toBe(true);
		expect(binding.hasPending()).toBe(false);
		expect(postUpdate).toHaveBeenCalledTimes(1);

		// The network is down: the edit is still waiting at the deadline, so the leave guard asks.
		postUpdate.mockRejectedValue({ status: 0 });
		text.insert(6, '?');
		await expect(binding.flush(300)).resolves.toBe(false);
		expect(binding.hasPending()).toBe(true);
		binding.destroy();
	});

	it('waits for the retry after a failed send instead of sending again at once', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;

		postUpdate.mockRejectedValueOnce({ status: 0 });
		text.insert(5, '!');
		timers.shift()!.fn();
		await Promise.resolve();
		await Promise.resolve();

		// Only the 2 s retry is scheduled, not another 50 ms batch of the same edit.
		expect(timers.map((timer) => timer.ms)).toEqual([2000]);
		binding.destroy();
	});

	it('opens the session again when the server no longer holds it, and retries after a network failure', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;

		postUpdate.mockRejectedValueOnce({ status: 404 });
		text.insert(5, '!');
		await runTimers();
		expect(streams).toHaveLength(2);

		postUpdate.mockRejectedValueOnce({ status: 0 });
		text.insert(6, '?');
		await runTimers();
		// Tried again: the same edit went out a second time and was accepted.
		expect(postUpdate.mock.calls.length).toBeGreaterThanOrEqual(3);
		binding.destroy();
	});

	it('counts edits the server refused as not taken, until a writable session sends them', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();
		expect(binding.hasUnconfirmed()).toBe(false);
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;

		// The page was locked while the edit went: refused, and not sent again by this session.
		postUpdate.mockRejectedValueOnce({ status: 403 });
		text.insert(5, '!');
		await runTimers();
		expect(binding.hasPending()).toBe(false);
		expect(binding.hasUnconfirmed()).toBe(true);
		// Nothing to send, and still not saved: a leave guard asks.
		await expect(binding.flush(10)).resolves.toBe(false);

		// Still read-only when the session comes back: the edit is still not the server's.
		binding.start();
		streams[1].next(server.sync({ readOnly: true, reason: 'locked' }));
		await runTimers();
		expect(binding.hasUnconfirmed()).toBe(true);

		// Writable again: the sync sends what the server lacks, the refused edit included.
		binding.start();
		streams[2].next(server.sync());
		await runTimers();
		expect(binding.hasUnconfirmed()).toBe(false);
		Y.applyUpdate(server.doc, Buffer.from(posted[posted.length - 1], 'base64'));
		expect(textOf(server.doc)).toBe('Hello!');
		binding.destroy();
	});

	it('counts a batch sent to a session the server no longer held as not taken, until the reopened session sends it', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;

		postUpdate.mockRejectedValueOnce({ status: 404 });
		text.insert(5, '!');
		await runTimers();
		expect(streams).toHaveLength(2);
		expect(binding.hasPending()).toBe(false);
		expect(binding.hasUnconfirmed()).toBe(true);

		// The reopened session syncs: what the server lacks goes, the dropped batch included.
		streams[1].next(server.sync());
		await runTimers();
		expect(binding.hasUnconfirmed()).toBe(false);
		Y.applyUpdate(server.doc, Buffer.from(posted[posted.length - 1], 'base64'));
		expect(textOf(server.doc)).toBe('Hello!');
		binding.destroy();
	});

	it('still counts it when the reopened stream ends before its sync', async () => {
		const server = serverPage('Hello');
		const binding = bind();
		streams[0].next(server.sync());
		await runTimers();
		const text = (binding.doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText;

		postUpdate.mockRejectedValueOnce({ status: 404 });
		text.insert(5, '!');
		await runTimers();
		streams[1].error(new Error('gone'));

		expect(states[states.length - 1]).toMatchObject({ phase: 'ended', reason: 'unavailable' });
		expect(binding.hasUnconfirmed()).toBe(true);
		binding.destroy();
	});
});
