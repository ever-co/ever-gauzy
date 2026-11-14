import type { EditorState } from '@tiptap/pm/state';
import { absolutePositionToRelativePosition, ySyncPluginKey } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import type { ILiveAnchorPoint, LiveAnchorResolver, LiveRelativeRange } from '../comments/comment-anchor.model';
import { blockAround, textOffsetInBlock } from '../extensions/comment-ranges';

/**
 * Comment anchors in a page's shared document (`docs-collaboration` FR-16): the ends of a comment's range as Yjs
 * relative positions, which follow every concurrent edit, and their reading back as a block and an offset into its
 * text. The same walk as the platform's (`document-comment-anchor.ts`) and the other clients', so a position made here
 * is read alike everywhere.
 *
 * Part of the live chunk (loaded with `document-live.binding.ts`), so Yjs stays out of the editor's main chunk.
 */

/** The fragment of the shared document the editors bind (`Collaboration.configure({ field })`). */
export const LIVE_FIELD = 'default';

/** A node of the shared fragment: the fragment, an element, or a text. */
type LiveNode = Y.XmlFragment | Y.XmlElement | Y.XmlText;

function isLiveNode(value: unknown): value is LiveNode {
	return value instanceof Y.XmlFragment || value instanceof Y.XmlElement || value instanceof Y.XmlText;
}

function parentOf(type: LiveNode): LiveNode | null {
	const parent = (type as unknown as { parent?: unknown }).parent;
	return isLiveNode(parent) ? parent : null;
}

/** Whether a node is the fragment or under it. */
function isInside(type: LiveNode, fragment: Y.XmlFragment): boolean {
	for (let current: LiveNode | null = type; current; current = parentOf(current)) {
		if (current === fragment) return true;
	}
	return false;
}

/** The text length of a node, as the anchors count it: a text's characters, an element's children's. */
function liveTextLength(type: unknown): number {
	if (type instanceof Y.XmlText) return type.length;
	if (type instanceof Y.XmlElement || type instanceof Y.XmlFragment) {
		let length = 0;
		for (const child of type.toArray()) length += liveTextLength(child);
		return length;
	}
	return 0;
}

/** The block and offset of `(type, index)`: the nearest element with a `blockId` above it, and the text before it there. */
function pointOf(type: LiveNode, index: number): ILiveAnchorPoint | null {
	let offset = 0;
	if (type instanceof Y.XmlText) {
		offset = Math.max(0, Math.min(index, type.length));
	} else {
		const children = type.toArray();
		for (let at = 0; at < Math.min(index, children.length); at += 1) offset += liveTextLength(children[at]);
	}
	let node: LiveNode = type;
	for (;;) {
		if (node instanceof Y.XmlElement) {
			const blockId = node.getAttribute('blockId');
			if (typeof blockId === 'string' && blockId.length > 0) return { blockId, offset };
		}
		const parent = parentOf(node);
		if (!parent || parent instanceof Y.XmlText) return null;
		// Only up from a live child: a text merged away (a hard break removed between two runs) is still in the store,
		// but no longer among its parent's children, and an offset counted past it would be wrong.
		let isChild = false;
		for (const sibling of parent.toArray()) {
			if (sibling === node) {
				isChild = true;
				break;
			}
			offset += liveTextLength(sibling);
		}
		if (!isChild) return null;
		node = parent;
	}
}

/**
 * The reader of relative positions in a page's shared document. A position the document does not hold yet, one that
 * is in no block with a `blockId`, or a value that is no relative position, reads as `null`.
 *
 * @param doc The shared document.
 * @param field The fragment the editors bind.
 */
export function liveAnchorResolverOf(doc: Y.Doc, field = LIVE_FIELD): LiveAnchorResolver {
	return resolverOf(doc, doc.getXmlFragment(field));
}

function resolverOf(doc: Y.Doc, fragment: Y.XmlFragment): LiveAnchorResolver {
	return (relative: string): ILiveAnchorPoint | null => {
		const absolute = absolutePositionOf(doc, relative);
		const type: unknown = absolute?.type;
		if (!absolute || !isLiveNode(type) || !isInside(type, fragment)) return null;
		return pointOf(type, absolute.index);
	};
}

/** Where a relative position (base64) is in `doc` now; null for text that is no relative position. */
function absolutePositionOf(doc: Y.Doc, relative: string): Y.AbsolutePosition | null {
	const bytes = fromBase64(relative);
	if (!bytes?.length) return null;
	try {
		// Not following deletions this client undid: every copy of the page (the platform's, the other editors') reads a
		// shared position alike.
		return Y.createAbsolutePositionFromRelativePosition(Y.decodeRelativePosition(bytes), doc, false);
	} catch {
		return null;
	}
}

/** The sync plugin's state, as far as the anchors read it. */
interface ISyncState {
	type?: Y.XmlFragment;
	binding?: { mapping?: Map<unknown, unknown>; type?: Y.XmlFragment } | null;
}

/**
 * The live relative positions of a range of the editor's document, when the editor is bound to `doc` (its sync plugin
 * holds the binding and its mapping); null otherwise. The positions are read back at once: ends that do not lead to the
 * same block and offsets (a binding not caught up yet) are not kept, and the range is then kept by its offsets.
 *
 * @param state The editor's state.
 * @param doc The shared document the editor is bound to.
 */
export function liveRelativeRangeOf(state: EditorState, doc: Y.Doc | null | undefined): LiveRelativeRange | null {
	if (!doc) return null;
	const sync = ySyncPluginKey.getState(state) as ISyncState | undefined;
	const mapping = sync?.binding?.mapping;
	const fragment = sync?.type ?? sync?.binding?.type;
	if (!mapping || !fragment || fragment.doc !== doc) return null;
	const resolve = resolverOf(doc, fragment);
	return (from, to) => {
		try {
			const relativeStart = encodeRelative(absolutePositionToRelativePosition(from, fragment, mapping as never));
			const relativeEnd = encodeRelative(absolutePositionToRelativePosition(to, fragment, mapping as never));
			const startBlock = blockAround(state, from);
			const endBlock = blockAround(state, to);
			const readStart = resolve(relativeStart);
			const readEnd = resolve(relativeEnd);
			if (!startBlock || !endBlock || !readStart || !readEnd) return null;
			const sameStart =
				readStart.blockId === startBlock.blockId &&
				readStart.offset === textOffsetInBlock(startBlock.node, startBlock.pos, from);
			const sameEnd =
				readEnd.blockId === endBlock.blockId &&
				readEnd.offset === textOffsetInBlock(endBlock.node, endBlock.pos, to);
			return sameStart && sameEnd ? { relativeStart, relativeEnd } : null;
		} catch {
			return null;
		}
	};
}

/** A relative position as an anchor stores it: base64 of `Y.encodeRelativePosition`. */
export function encodeRelative(position: Y.RelativePosition): string {
	return base64(Y.encodeRelativePosition(position));
}

/** Base64 of bytes (as the live routes and the anchors carry them). */
export function base64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
}

/** The bytes of base64 text; null for text that is no base64. */
function fromBase64(encoded: string): Uint8Array | null {
	let binary: string;
	try {
		binary = atob(encoded);
	} catch {
		return null;
	}
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}
