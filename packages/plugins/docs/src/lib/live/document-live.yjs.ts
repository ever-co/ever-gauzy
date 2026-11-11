// cspell:ignore GZLV ychange
import { createHash, randomInt } from 'node:crypto';
import * as Y from 'yjs';

/**
 * The Yjs side of a live page: TipTap JSON in and out of the shared document, the seed every process builds
 * alike, the replacement of server-side writes, and the marker that says which revision a stored state is.
 *
 * The editor binds its ProseMirror document to the `default` XML fragment, which is TipTap's `Collaboration`
 * extension's default field. The conversion follows y-prosemirror's own (`@tiptap/y-tiptap`), which the editor
 * runs, so what the server writes the editor reads and the other way round:
 *
 * - an element node is a `Y.XmlElement` named after its type, with every attribute that is not `null`;
 * - a run of text nodes inside an element is one `Y.XmlText`, each text node a delta insert whose attributes are
 *   its marks (`{ [markType]: markAttrs }`), and an unmarked node an insert with no attributes;
 * - an inline node that is not text (a mention, a hard break) is an element between the texts.
 *
 * The backend has no ProseMirror schema (the editor's extensions are Angular packages), so this works on the
 * JSON as stored rather than through `Node.fromJSON`, as `validateTiptapDocument` and `generateDocumentHtml` do.
 */

/** The XML fragment the editor's `Collaboration` extension binds to. */
export const LIVE_FRAGMENT = 'default';

/**
 * The first bytes of a stored live state. The meta travels in this header, outside the shared document: an editor
 * writes the shared document, and must not be able to rewrite which lineage or revision the server holds it for.
 */
const LIVE_STATE_MAGIC = Buffer.from('GZLV1', 'ascii');

/** A TipTap / ProseMirror JSON node, as stored in `contentJson`. */
export interface ILiveJsonNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: ILiveJsonNode[];
	marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
	text?: string;
}

/** Which page and revision a stored live state was written for. */
export interface ILiveMeta {
	/** The page and the revision whose content the state was seeded from: one lineage per seed. */
	lineage: string;
	/** The `contentRevision` the state was last persisted under. */
	revision: number;
}

/**
 * The client id a seed is built with, the same in every process for one page and revision.
 *
 * Two processes that open the same page each seed it from the stored JSON. Built with the same client id and in
 * the same order, the two seeds are the same Yjs items, so merging them is a no-op instead of a page whose content
 * appears twice.
 *
 * @param documentId The page.
 * @param revision The revision the seed is built from.
 * @returns A 32-bit client id.
 */
export function seedClientId(documentId: string, revision: number): number {
	const digest = createHash('sha256').update(`gauzy-docs-live:${documentId}:${revision}`).digest();
	// Yjs client ids are unsigned 32-bit numbers; zero is avoided only to keep it obviously set.
	return digest.readUInt32BE(0) || 1;
}

/** A fresh client id for the server's own writes after the seed (a restore, a Markdown update). */
export function randomClientId(): number {
	return randomInt(1, 0xffffffff);
}

/**
 * The lineage of a seed: the page and the revision it was built from.
 *
 * @param documentId The page.
 * @param revision The seed revision.
 */
export function lineageOf(documentId: string, revision: number): string {
	return `${documentId}:${revision}`;
}

/**
 * Builds the shared document of a page from its stored JSON, alike in every process.
 *
 * @param documentId The page.
 * @param revision The page's `contentRevision`.
 * @param contentJson The page's `contentJson` (`null` is an empty page).
 * @returns The document, its client id already random again for the writes that follow.
 */
export function seedLiveDocument(documentId: string, revision: number, contentJson: unknown): Y.Doc {
	const doc = new Y.Doc({ gc: true });
	doc.clientID = seedClientId(documentId, revision);
	doc.transact(() => writeBlocks(doc.getXmlFragment(LIVE_FRAGMENT), 0, blocksOf(contentJson)), 'seed');
	doc.clientID = randomClientId();
	return doc;
}

/**
 * Decodes a stored `contentBinary` as a live state.
 *
 * The editor has always sent a seed of its own in `contentBinary` (`document-binary.util.ts` in docs-ui); that one
 * has no header, binds another fragment, and is no live state.
 *
 * @param binary The stored bytes.
 * @returns The document and its meta, or `null` when the bytes are absent, unreadable, or not a live state.
 */
export function decodeLiveState(
	binary: Uint8Array | Buffer | null | undefined
): { doc: Y.Doc; meta: ILiveMeta } | null {
	const bytes = binary ? Buffer.from(binary.buffer, binary.byteOffset, binary.byteLength) : null;
	const metaStart = LIVE_STATE_MAGIC.length + 4;
	if (!bytes || bytes.length < metaStart || !bytes.subarray(0, LIVE_STATE_MAGIC.length).equals(LIVE_STATE_MAGIC)) {
		return null;
	}
	const metaEnd = metaStart + bytes.readUInt32BE(LIVE_STATE_MAGIC.length);
	if (metaEnd > bytes.length) {
		return null;
	}
	let meta: ILiveMeta;
	try {
		const parsed = JSON.parse(bytes.subarray(metaStart, metaEnd).toString('utf8'));
		const revision = Number(parsed?.revision);
		if (typeof parsed?.lineage !== 'string' || !parsed.lineage || !Number.isInteger(revision) || revision < 1) {
			return null;
		}
		meta = { lineage: parsed.lineage, revision };
	} catch {
		return null;
	}
	const doc = new Y.Doc({ gc: true });
	try {
		Y.applyUpdate(doc, new Uint8Array(bytes.subarray(metaEnd)), 'storage');
	} catch {
		doc.destroy();
		return null;
	}
	return { doc, meta };
}

/**
 * The stored bytes of a shared document: the header with its meta, then the document's state.
 *
 * @param doc The document.
 * @param meta The lineage, and the revision it is stored under.
 */
export function encodeLiveState(doc: Y.Doc | Uint8Array, meta: ILiveMeta): Buffer {
	const metaBytes = Buffer.from(JSON.stringify({ lineage: meta.lineage, revision: meta.revision }), 'utf8');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(metaBytes.length, 0);
	const state = doc instanceof Uint8Array ? doc : Y.encodeStateAsUpdate(doc);
	return Buffer.concat([
		LIVE_STATE_MAGIC,
		length,
		metaBytes,
		Buffer.from(state.buffer, state.byteOffset, state.byteLength)
	]);
}

/**
 * The page's TipTap JSON, read from the shared document.
 *
 * @param doc The document.
 * @returns `{ type: 'doc', content }`.
 */
export function liveDocumentJson(doc: Y.Doc): ILiveJsonNode {
	const content = doc
		.getXmlFragment(LIVE_FRAGMENT)
		.toArray()
		.flatMap((child) => readNode(child));
	return content.length ? { type: 'doc', content } : { type: 'doc', content: [] };
}

/**
 * Replaces the shared document's content with a page written on the server (a restore, a Markdown update, an API
 * save), in one transaction, block by block.
 *
 * The top-level blocks that are the same before and after stay, so the people editing elsewhere in the page keep
 * their text and cursors; each block that changed is removed and the new one inserted where it belongs. A block an
 * editor is typing in when the replacement removes it is replaced too: a server write states the whole page.
 *
 * @param doc The document.
 * @param contentJson The new content.
 * @param origin The transaction origin.
 * @returns How many blocks were kept and how many written.
 */
export function replaceLiveContent(
	doc: Y.Doc,
	contentJson: unknown,
	origin: unknown = 'server'
): { kept: number; written: number } {
	const fragment = doc.getXmlFragment(LIVE_FRAGMENT);
	const next = blocksOf(contentJson);
	const nextKeys = next.map((block) => blockKey(block));
	const currentKeys = fragment.toArray().map((child) => blockKey(readNode(child)[0] ?? { type: 'paragraph' }));
	const kept = commonSubsequence(currentKeys, nextKeys);

	doc.transact(() => {
		// Removed from the end, so the indexes of the blocks still to visit hold.
		const keptCurrent = new Set(kept.map(([currentIndex]) => currentIndex));
		for (let index = currentKeys.length - 1; index >= 0; index -= 1) {
			if (!keptCurrent.has(index)) {
				fragment.delete(index, 1);
			}
		}
		// What is left is the kept blocks in order; the new ones are inserted between them.
		const keptNext = new Set(kept.map(([, nextIndex]) => nextIndex));
		let position = 0;
		for (let index = 0; index < next.length; index += 1) {
			if (keptNext.has(index)) {
				position += 1;
				continue;
			}
			writeBlocks(fragment, position, [next[index]]);
			position += 1;
		}
	}, origin);

	return { kept: kept.length, written: next.length - kept.length };
}

/**
 * The change a server-side write makes, computed against the state the write replaced rather than against what
 * editors hold now.
 *
 * The stored state is the page as the write found it (`previous.contentJson`). The replacement is worked out on a
 * copy of it, so only the blocks the write changed are removed and inserted; applied to a live document that holds
 * unsaved edits on top of that state, the change merges with them: an edit in a block the write did not change stays,
 * an edit in a block it replaced goes with the block.
 *
 * @param baseState The Yjs state the write found (the stored live state of the previous revision).
 * @param contentJson The content the write saved.
 * @returns The change as a Yjs update, and the whole state after it.
 */
export function serverWriteChange(
	baseState: Uint8Array,
	contentJson: unknown
): { change: Uint8Array; state: Uint8Array } {
	const base = new Y.Doc({ gc: true });
	try {
		Y.applyUpdate(base, baseState, 'storage');
		const before = Y.encodeStateVector(base);
		replaceLiveContent(base, contentJson, 'server');
		return { change: Y.encodeStateAsUpdate(base, before), state: Y.encodeStateAsUpdate(base) };
	} finally {
		base.destroy();
	}
}

/**
 * A page's `contentRevision` as a number: a row from before revisions counts as 1.
 *
 * @param value The stored value.
 */
export function liveRevisionOf(value: unknown): number {
	const revision = Number(value);
	return Number.isFinite(revision) && revision >= 1 ? revision : 1;
}

/**
 * Whether stored bytes are the live state of the revision a page is at.
 *
 * @param binary The page's `contentBinary`.
 * @param revision The page's `contentRevision`.
 */
export function isLiveStateFor(binary: Uint8Array | Buffer | null | undefined, revision: unknown): boolean {
	const state = decodeLiveState(binary);
	state?.doc.destroy();
	return !!state && state.meta.revision === liveRevisionOf(revision);
}

/**
 * The page's top-level blocks a set of changed Yjs types belongs to, as JSON; `all` when the page's own list of
 * blocks changed (a block added, removed or moved), in which case every block is returned.
 *
 * @param doc The document.
 * @param changed The types a transaction changed (`transaction.changed`'s keys).
 */
export function changedBlocksJson(doc: Y.Doc, changed: Iterable<unknown>): { all: boolean; blocks: ILiveJsonNode[] } {
	const fragment = doc.getXmlFragment(LIVE_FRAGMENT);
	const tops = new Set<unknown>();
	for (const type of changed) {
		let current = type as { _item?: { parent?: unknown } | null } | null;
		if (current === (fragment as unknown)) {
			return { all: true, blocks: liveDocumentJson(doc).content ?? [] };
		}
		// Up the tree to the child of the fragment that holds the change.
		for (let depth = 0; current && depth < 256; depth += 1) {
			const parent = current._item?.parent;
			if (parent === (fragment as unknown)) {
				tops.add(current);
				break;
			}
			current = (parent as typeof current) ?? null;
		}
	}
	const blocks: ILiveJsonNode[] = [];
	for (const child of fragment.toArray()) {
		if (tops.has(child)) {
			blocks.push(...readNode(child));
		}
	}
	return { all: false, blocks };
}

/**
 * A stable comparison key of a block: its normalised JSON (no `null` attributes, no empty mark attributes, adjacent
 * texts with the same marks joined), which is what the shared document gives back for it.
 *
 * @param block The block.
 */
export function blockKey(block: ILiveJsonNode): string {
	return stableStringify(normaliseNode(block));
}

/**
 * Normalises TipTap JSON the way the shared document will give it back, so two writers compare like with like.
 *
 * @param node The node.
 */
export function normaliseNode(node: ILiveJsonNode): ILiveJsonNode {
	const out: ILiveJsonNode = { type: node.type };
	if (node.type === 'text') {
		out.text = String(node.text ?? '');
		const marks = (node.marks ?? []).map((mark) => {
			const attrs = withoutNulls(mark.attrs);
			return attrs ? { type: mark.type, attrs } : { type: mark.type };
		});
		if (marks.length) {
			out.marks = marks;
		}
		return out;
	}
	const attrs = withoutNulls(node.attrs);
	if (attrs) {
		out.attrs = attrs;
	}
	const content = joinTexts(
		(node.content ?? []).map((child) => normaliseNode(child)).filter((child) => child.type !== 'text' || child.text)
	);
	if (content.length) {
		out.content = content;
	}
	return out;
}

/* ------------------------------------------------------------------------------------------------------------- */

function blocksOf(contentJson: unknown): ILiveJsonNode[] {
	const root = contentJson as ILiveJsonNode | null | undefined;
	if (!root || typeof root !== 'object' || !Array.isArray(root.content)) {
		return [];
	}
	return root.content.filter(
		(node): node is ILiveJsonNode => !!node && typeof node === 'object' && typeof node.type === 'string'
	);
}

/** Writes JSON nodes into an XML parent at an index, as y-prosemirror does. */
function writeBlocks(parent: Y.XmlFragment | Y.XmlElement, index: number, nodes: ILiveJsonNode[]): void {
	const types = toYTypes(nodes);
	if (types.length) {
		parent.insert(index, types);
	}
}

/** Element nodes become elements; each run of text nodes becomes one text. */
function toYTypes(nodes: ILiveJsonNode[]): Array<Y.XmlElement | Y.XmlText> {
	const out: Array<Y.XmlElement | Y.XmlText> = [];
	let run: ILiveJsonNode[] = [];
	const flush = (): void => {
		if (run.length) {
			const text = new Y.XmlText();
			text.applyDelta(
				run.map((node) => ({ insert: String(node.text ?? ''), attributes: marksToAttributes(node.marks) }))
			);
			out.push(text);
			run = [];
		}
	};
	for (const node of nodes) {
		if (node.type === 'text') {
			if (node.text) {
				run.push(node);
			}
			continue;
		}
		flush();
		const element = new Y.XmlElement(node.type);
		for (const [key, value] of Object.entries(node.attrs ?? {})) {
			if (value !== null && value !== undefined && key !== 'ychange') {
				element.setAttribute(key, value as never);
			}
		}
		const children = toYTypes(Array.isArray(node.content) ? node.content : []);
		if (children.length) {
			element.insert(0, children);
		}
		out.push(element);
	}
	flush();
	return out;
}

function marksToAttributes(marks: ILiveJsonNode['marks']): Record<string, unknown> {
	const attributes: Record<string, unknown> = {};
	for (const mark of marks ?? []) {
		if (mark?.type && mark.type !== 'ychange') {
			attributes[mark.type] = { ...(mark.attrs ?? {}) };
		}
	}
	return attributes;
}

/** Reads one Y type back as JSON nodes (a text gives one node per formatted run). */
function readNode(item: unknown): ILiveJsonNode[] {
	if (item instanceof Y.XmlText) {
		return (
			item.toDelta() as Array<{ insert: unknown; attributes?: Record<string, Record<string, unknown> | null> }>
		)
			.filter((run) => typeof run.insert === 'string' && run.insert.length > 0)
			.map((run) => {
				const node: ILiveJsonNode = { type: 'text', text: run.insert as string };
				const marks = Object.entries(run.attributes ?? {})
					.filter(([, attrs]) => attrs !== null && attrs !== undefined)
					.map(([key, attrs]) => {
						// y-prosemirror names an overlapping mark `<type>--<hash>`.
						const type = key.replace(/--[a-zA-Z0-9+/=]{8}$/, '');
						const markAttrs = withoutNulls(attrs as Record<string, unknown>);
						return markAttrs ? { type, attrs: markAttrs } : { type };
					});
				if (marks.length) {
					node.marks = marks;
				}
				return node;
			});
	}
	if (item instanceof Y.XmlElement) {
		const node: ILiveJsonNode = { type: item.nodeName };
		const attrs = withoutNulls(item.getAttributes() as Record<string, unknown>);
		if (attrs) {
			node.attrs = attrs;
		}
		const content = item.toArray().flatMap((child) => readNode(child));
		if (content.length) {
			node.content = content;
		}
		return [node];
	}
	return [];
}

function withoutNulls(attrs: Record<string, unknown> | null | undefined): Record<string, unknown> | undefined {
	if (!attrs || typeof attrs !== 'object') {
		return undefined;
	}
	const entries = Object.entries(attrs).filter(
		([key, value]) => value !== null && value !== undefined && key !== 'ychange'
	);
	return entries.length ? Object.fromEntries(entries) : undefined;
}

function joinTexts(nodes: ILiveJsonNode[]): ILiveJsonNode[] {
	const out: ILiveJsonNode[] = [];
	for (const node of nodes) {
		const previous = out[out.length - 1];
		if (
			previous &&
			previous.type === 'text' &&
			node.type === 'text' &&
			stableStringify(previous.marks ?? []) === stableStringify(node.marks ?? [])
		) {
			out[out.length - 1] = { ...previous, text: `${previous.text ?? ''}${node.text ?? ''}` };
			continue;
		}
		out.push(node);
	}
	return out;
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(',')}]`;
	}
	if (value && typeof value === 'object') {
		const keys = Object.keys(value as Record<string, unknown>).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
	}
	return JSON.stringify(value ?? null);
}

/**
 * The pairs `[currentIndex, nextIndex]` of a longest common subsequence of two key lists.
 *
 * Quadratic, so above a few million cells it gives up and keeps nothing: the replacement then rewrites the whole
 * page, which is correct, only less kind to the cursors.
 */
function commonSubsequence(current: string[], next: string[]): Array<[number, number]> {
	const n = current.length;
	const m = next.length;
	if (!n || !m || n * m > 4_000_000) {
		return [];
	}
	const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			table[i][j] = current[i] === next[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	const pairs: Array<[number, number]> = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (current[i] === next[j]) {
			pairs.push([i, j]);
			i += 1;
			j += 1;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
			i += 1;
		} else {
			j += 1;
		}
	}
	return pairs;
}
