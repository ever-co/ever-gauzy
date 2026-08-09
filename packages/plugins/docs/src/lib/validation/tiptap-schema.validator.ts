import { BadRequestException } from '@nestjs/common';
import { DOCS_CONTENT_SCHEMA_INVALID } from '../docs.constants';

/**
 * Recursive schema validator for the canonical PAGE payload (`08-permissions-security.md` §6.1
 * step 1 + step 3).
 *
 * The TipTap schema is the first line of defense: `contentJson` is what every read path renders
 * from, so an unknown node type, an unknown mark, an attribute key outside the schema, or a
 * `javascript:` link must be a **400**, not a silent strip — a silent strip masks client bugs and
 * still leaves the client and the server disagreeing about what was saved.
 *
 * 🛑 The node/mark inventory below is a **mirror of the editor's registered extension set**
 * (`packages/plugins/docs-ui/src/lib/editor/extensions/document-extensions.ts` →
 * `createStaticExtensions()`, normative in `05-editor-spec.md` §5). The two live in different
 * packages on purpose — the backend must never import the Angular editor — so any extension added
 * there has to be added here in the same change, or that node type becomes unsavable.
 */

/**
 * Attribute keys accepted on **every** node.
 *
 * `blockId` is the `@tiptap/extension-unique-id` anchor (comment anchors + `?block=` deep links,
 * `05` §5/§8). It is allowed everywhere rather than on the extension's exact `types` list because
 * widening that list is a pure editor-side change that must not start rejecting saves.
 */
const COMMON_NODE_ATTRIBUTES: readonly string[] = ['blockId'];

/**
 * The node types of the `gz-document-editor` schema and the attribute keys each one may carry.
 *
 * `uploadId` (image, fileAttachment) is the **transient** upload marker of `05` §6.6. The client
 * strips it in `sanitizeContentJson()` before saving, so it should never arrive — it is tolerated
 * rather than rejected so that a stale client tab cannot 400 every one of its autosaves, and it is
 * dropped on the way into storage (see `stripTransientAttributes`).
 */
export const DOCS_SCHEMA_NODES: Readonly<Record<string, readonly string[]>> = {
	// StarterKit core
	doc: [],
	paragraph: ['textAlign'],
	text: [],
	heading: ['level', 'textAlign'],
	blockquote: [],
	bulletList: [],
	orderedList: ['start', 'type'],
	listItem: [],
	horizontalRule: [],
	hardBreak: [],
	// CodeBlockLowlight (replaces StarterKit's codeBlock, same node name)
	codeBlock: ['language'],
	// TaskList / TaskItem
	taskList: [],
	taskItem: ['checked'],
	// TableKit
	table: [],
	tableRow: [],
	tableHeader: ['colspan', 'rowspan', 'colwidth'],
	tableCell: ['colspan', 'rowspan', 'colwidth'],
	// Media
	image: ['src', 'alt', 'title', 'width', 'height', 'documentId', 'align', 'uploadId'],
	youtube: ['src', 'start', 'width', 'height'],
	// Details (persist: true)
	details: ['open'],
	detailsSummary: [],
	detailsContent: [],
	// Emoji + Mathematics
	emoji: ['name'],
	inlineMath: ['latex'],
	blockMath: ['latex'],
	// The three first-party custom nodes (`05` §6.2)
	callout: ['type', 'emoji'],
	fileAttachment: ['documentId', 'name', 'size', 'mimeType', 'uploadId'],
	embedCard: ['url', 'title', 'description', 'imageUrl'],
	// Mention registered twice (`05` §7)
	employeeMention: ['id', 'label', 'mentionSuggestionChar'],
	documentMention: ['id', 'label', 'mentionSuggestionChar']
};

/**
 * The mark types of the schema and the attribute keys each one may carry. `textStyle` carries the
 * `TextStyleKit` global attributes (Color, BackgroundColor, FontFamily, FontSize, LineHeight).
 */
export const DOCS_SCHEMA_MARKS: Readonly<Record<string, readonly string[]>> = {
	bold: [],
	italic: [],
	strike: [],
	underline: [],
	code: [],
	subscript: [],
	superscript: [],
	link: ['href', 'target', 'rel', 'class', 'title'],
	highlight: ['color'],
	textStyle: ['color', 'backgroundColor', 'fontFamily', 'fontSize', 'lineHeight']
};

/** URL schemes a `link.href` may use (`08` §6.1 step 3 — same list as `sanitizeRichHtml`). */
const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Schemes an `image.src` may use. `data:` and `blob:` are absent by design: the editor uploads
 * through the Documents API and persists the stable `/api/plugins/docs/documents/:id/raw` URL
 * (`05` §6.6), so an inline payload in the canonical JSON is always a bug or an attack.
 */
const ALLOWED_IMAGE_SCHEMES = ['http:', 'https:'];

/** `@tiptap/extension-unique-id` emits a UUID v4; accept any UUID shape. */
const BLOCK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Transient attributes dropped from the persisted JSON (`05` §6.6). */
const TRANSIENT_ATTRIBUTES: readonly string[] = ['uploadId'];

/** Depth ceiling — a pathological nesting depth is a denial-of-service payload, not a document. */
const MAX_NODE_DEPTH = 100;

/** Node ceiling — the same reasoning applied to breadth. */
const MAX_NODE_COUNT = 50_000;

/**
 * Raises the canonical schema-violation error. One code (`DOCS_CONTENT_SCHEMA_INVALID`) with a
 * human-readable `path` so the editor can point at the offending node instead of just failing.
 *
 * @param path The JSON pointer-ish path of the offending node.
 * @param reason What is wrong there.
 */
function reject(path: string, reason: string): never {
	throw new BadRequestException({
		message: `Invalid document content at ${path}: ${reason}`,
		code: DOCS_CONTENT_SCHEMA_INVALID,
		path
	});
}

/**
 * Whether a value is a plain JSON object (and not an array or `null`).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates one URL string against a scheme allowlist.
 *
 * Relative URLs are accepted for images only: the editor persists the app-relative raw URL
 * (`/api/plugins/docs/documents/:id/raw`), which has no scheme at all.
 *
 * @param raw The attribute value.
 * @param schemes The permitted schemes.
 * @param allowRelative Whether a scheme-less, path-absolute URL is acceptable.
 * @returns True when the value is acceptable.
 */
function isAllowedUrl(raw: unknown, schemes: string[], allowRelative: boolean): boolean {
	if (typeof raw !== 'string' || raw.trim() === '') {
		return false;
	}
	const value = raw.trim();
	if (allowRelative && value.startsWith('/') && !value.startsWith('//')) {
		return true;
	}
	try {
		return schemes.includes(new URL(value).protocol.toLowerCase());
	} catch {
		return false;
	}
}

/**
 * Validates the attribute bag of one node or mark against its declared key list.
 *
 * @param attrs The `attrs` value as it arrived.
 * @param allowed The attribute keys declared for this type.
 * @param path The path used in error messages.
 * @param common Extra keys allowed on top (the per-node common set; empty for marks).
 */
function validateAttributes(attrs: unknown, allowed: readonly string[], path: string, common: readonly string[]): void {
	if (attrs === undefined || attrs === null) {
		return;
	}
	if (!isPlainObject(attrs)) {
		reject(`${path}.attrs`, 'attributes must be an object');
	}
	for (const key of Object.keys(attrs)) {
		if (!allowed.includes(key) && !common.includes(key)) {
			reject(`${path}.attrs.${key}`, 'attribute is not part of the document schema');
		}
	}
	const blockId = (attrs as Record<string, unknown>)['blockId'];
	if (blockId !== undefined && blockId !== null && !BLOCK_ID_PATTERN.test(String(blockId))) {
		reject(`${path}.attrs.blockId`, 'block id is not a valid UniqueID value');
	}
}

/**
 * Validates the marks of one text node.
 *
 * @param marks The `marks` value as it arrived.
 * @param path The path used in error messages.
 */
function validateMarks(marks: unknown, path: string): void {
	if (marks === undefined || marks === null) {
		return;
	}
	if (!Array.isArray(marks)) {
		reject(`${path}.marks`, 'marks must be an array');
	}
	marks.forEach((mark: unknown, index: number) => {
		const markPath = `${path}.marks[${index}]`;
		if (!isPlainObject(mark)) {
			reject(markPath, 'mark must be an object');
		}
		const type = (mark as Record<string, unknown>)['type'];
		if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(DOCS_SCHEMA_MARKS, type)) {
			reject(markPath, `unknown mark type "${String(type)}"`);
		}
		validateAttributes((mark as Record<string, unknown>)['attrs'], DOCS_SCHEMA_MARKS[type as string], markPath, []);

		// §6.1 step 3 — the one mark attribute that is a live XSS vector.
		if (type === 'link') {
			const href = ((mark as Record<string, unknown>)['attrs'] as Record<string, unknown> | undefined)?.['href'];
			if (href !== undefined && href !== null && !isAllowedUrl(href, ALLOWED_LINK_SCHEMES, true)) {
				reject(`${markPath}.attrs.href`, 'link scheme is not allowed (http, https, mailto, tel only)');
			}
		}
	});
}

/**
 * Recursively validates one node and its content.
 *
 * @param node The node as it arrived.
 * @param path The path used in error messages.
 * @param depth The current nesting depth.
 * @param counter A single-element node budget, shared across the whole walk.
 */
function validateNode(node: unknown, path: string, depth: number, counter: { count: number }): void {
	if (depth > MAX_NODE_DEPTH) {
		reject(path, `document nesting exceeds ${MAX_NODE_DEPTH} levels`);
	}
	if (++counter.count > MAX_NODE_COUNT) {
		reject(path, `document exceeds ${MAX_NODE_COUNT} nodes`);
	}
	if (!isPlainObject(node)) {
		reject(path, 'node must be an object');
	}

	const type = (node as Record<string, unknown>)['type'];
	if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(DOCS_SCHEMA_NODES, type)) {
		reject(path, `unknown node type "${String(type)}"`);
	}

	validateAttributes((node as Record<string, unknown>)['attrs'], DOCS_SCHEMA_NODES[type], path, COMMON_NODE_ATTRIBUTES);

	// §6.1 step 3 — no `data:`/`blob:`/third-party image payloads in the canonical JSON.
	if (type === 'image') {
		const src = ((node as Record<string, unknown>)['attrs'] as Record<string, unknown> | undefined)?.['src'];
		if (src !== undefined && src !== null && !isAllowedUrl(src, ALLOWED_IMAGE_SCHEMES, true)) {
			reject(`${path}.attrs.src`, 'image source must be a platform storage URL (no data:, no blob:)');
		}
	}

	if (type === 'text') {
		if (typeof (node as Record<string, unknown>)['text'] !== 'string') {
			reject(path, 'a text node must carry a string `text`');
		}
		validateMarks((node as Record<string, unknown>)['marks'], path);
		return;
	}

	validateMarks((node as Record<string, unknown>)['marks'], path);

	const content = (node as Record<string, unknown>)['content'];
	if (content === undefined || content === null) {
		return;
	}
	if (!Array.isArray(content)) {
		reject(`${path}.content`, 'content must be an array');
	}
	content.forEach((child: unknown, index: number) =>
		validateNode(child, `${path}.content[${index}]`, depth + 1, counter)
	);
}

/**
 * Validates a canonical TipTap document and returns it.
 *
 * The root must be a `doc` node — that is what the editor loads and what
 * `@tiptap/static-renderer` renders; anything else would be unloadable content persisted as if it
 * were fine.
 *
 * @param value The `contentJson` payload as it arrived.
 * @returns The same value, typed, once it is proven schema-valid.
 * @throws BadRequestException `DOCS_CONTENT_SCHEMA_INVALID` on the first violation found.
 */
export function validateTiptapDocument(value: unknown): Record<string, unknown> {
	if (!isPlainObject(value)) {
		reject('contentJson', 'content must be a TipTap document object');
	}
	if (value['type'] !== 'doc') {
		reject('contentJson', 'the document root must be a `doc` node');
	}
	validateNode(value, 'contentJson', 0, { count: 0 });
	return value;
}

/**
 * Removes the transient editor-only attributes (`uploadId`) from a validated document.
 *
 * The client already does this before saving; doing it again server-side is what makes it a
 * guarantee of the stored row rather than a client convention.
 *
 * @param value A schema-valid document.
 * @returns A copy with every transient attribute dropped.
 */
export function stripTransientAttributes<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => stripTransientAttributes(item)) as unknown as T;
	}
	if (!isPlainObject(value)) {
		return value;
	}
	const output: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (key === 'attrs' && isPlainObject(item)) {
			const attrs: Record<string, unknown> = {};
			for (const [attrKey, attrValue] of Object.entries(item)) {
				if (!TRANSIENT_ATTRIBUTES.includes(attrKey)) {
					attrs[attrKey] = attrValue;
				}
			}
			output[key] = attrs;
			continue;
		}
		output[key] = stripTransientAttributes(item);
	}
	return output as unknown as T;
}

/**
 * Collects the ids of every `documentMention` node in a validated document (`05` §7.2).
 *
 * @param value A schema-valid document (or any subtree of one).
 * @returns The deduplicated, non-empty mentioned document ids in document order.
 */
export function collectDocumentMentionIds(value: unknown): string[] {
	const ids = new Set<string>();
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (!isPlainObject(node)) {
			return;
		}
		if (node['type'] === 'documentMention') {
			const id = (node['attrs'] as Record<string, unknown> | undefined)?.['id'];
			if (typeof id === 'string' && id.trim() !== '') {
				ids.add(id.trim());
			}
		}
		walk(node['content']);
	};
	walk(value);
	return [...ids];
}
