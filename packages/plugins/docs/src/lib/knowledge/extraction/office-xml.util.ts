import { DocsPermanentError } from '../errors';

/**
 * A minimal, dependency-free XML reader for the office parts this plugin extracts
 * (`ppt/slides/slideN.xml`, OpenDocument `content.xml`).
 *
 * Scope is deliberately narrow — it parses elements, attributes, text and CDATA, and nothing
 * else. It is NOT a general XML processor:
 *
 * - `<!DOCTYPE …>` is SKIPPED WHOLE and no entity declared in it is ever resolved, so a
 *   billion-laughs / XXE payload in an uploaded document expands to nothing. Only the five
 *   predefined entities and numeric character references are decoded.
 * - Namespace prefixes are kept verbatim on `name`, and {@link IXmlNode.localName} carries the
 *   part after the colon — office writers vary the prefix (`a:` vs `p:` vs a default namespace),
 *   so every lookup in the extractors matches on the LOCAL name.
 * - Depth and node count are capped, because the input is an untrusted upload.
 */

/** Maximum element nesting accepted (real office parts sit well under 100). */
const MAX_DEPTH = 256;

/** Maximum number of elements parsed from one part. */
const MAX_NODES = 500_000;

/** One parsed element. */
export interface IXmlNode {
	/** Qualified tag name as written, e.g. `a:t`. */
	name: string;
	/** Tag name without its namespace prefix, e.g. `t`. */
	localName: string;
	/** Attributes keyed by their qualified name, values entity-decoded. */
	attributes: Record<string, string>;
	/** Child elements, in document order. */
	children: IXmlNode[];
	/**
	 * The element's own text content, in document order, with each child element's position
	 * represented by the child itself — see {@link IXmlNode.content}.
	 */
	content: (string | IXmlNode)[];
}

/** The five entities XML predefines; nothing else is ever expanded. */
const PREDEFINED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'"
};

/**
 * Parses an XML document into an element tree.
 *
 * @param xml The XML source.
 * @returns The root element.
 * @throws DocsPermanentError when the document is not well-formed enough to walk — a malformed
 *         part will not become well-formed on a retry.
 */
export function parseXml(xml: string): IXmlNode {
	if (!xml || !xml.trim()) {
		throw new DocsPermanentError('The document part is empty and could not be read.');
	}

	const root: IXmlNode = { name: '#document', localName: '#document', attributes: {}, children: [], content: [] };
	const stack: IXmlNode[] = [root];
	let nodeCount = 0;
	let cursor = 0;

	while (cursor < xml.length) {
		const open = xml.indexOf('<', cursor);
		if (open === -1) {
			appendText(stack[stack.length - 1], xml.slice(cursor));
			break;
		}
		if (open > cursor) {
			appendText(stack[stack.length - 1], xml.slice(cursor, open));
		}

		// Declarations, comments, CDATA and the doctype — none of which produce elements.
		if (xml.startsWith('<?', open)) {
			cursor = skipTo(xml, open, '?>');
			continue;
		}
		if (xml.startsWith('<!--', open)) {
			cursor = skipTo(xml, open, '-->');
			continue;
		}
		if (xml.startsWith('<![CDATA[', open)) {
			const end = xml.indexOf(']]>', open);
			const raw = end === -1 ? xml.slice(open + 9) : xml.slice(open + 9, end);
			// CDATA is literal text: it is NOT entity-decoded.
			stack[stack.length - 1].content.push(raw);
			cursor = end === -1 ? xml.length : end + 3;
			continue;
		}
		if (xml.startsWith('<!', open)) {
			// 🛑 The doctype is skipped WHOLE, internal subset included, so no entity it declares
			// can ever be expanded. That is the XXE / entity-expansion defense.
			cursor = skipDoctype(xml, open);
			continue;
		}

		const close = findTagEnd(xml, open);
		if (close === -1) {
			throw new DocsPermanentError('The document part could not be read — it contains an unterminated tag.');
		}
		const tag = xml.slice(open + 1, close);
		cursor = close + 1;

		if (tag.startsWith('/')) {
			// Closing tag: unwind to the matching element, tolerating a stray close.
			const name = tag.slice(1).trim();
			for (let depth = stack.length - 1; depth > 0; depth--) {
				if (stack[depth].name === name) {
					stack.length = depth;
					break;
				}
			}
			continue;
		}

		const selfClosing = tag.endsWith('/');
		const node = parseTag(selfClosing ? tag.slice(0, -1) : tag);
		if (++nodeCount > MAX_NODES) {
			throw new DocsPermanentError('The document contains too many elements to process.');
		}
		const parent = stack[stack.length - 1];
		parent.children.push(node);
		parent.content.push(node);
		if (!selfClosing) {
			if (stack.length >= MAX_DEPTH) {
				throw new DocsPermanentError('The document is nested too deeply to process.');
			}
			stack.push(node);
		}
	}

	return root;
}

/**
 * Every descendant (depth-first, document order) whose local name matches.
 *
 * @param node The subtree root.
 * @param localName The unprefixed tag name to match.
 * @returns The matching descendants.
 */
export function findAll(node: IXmlNode, localName: string): IXmlNode[] {
	const found: IXmlNode[] = [];
	const walk = (current: IXmlNode): void => {
		for (const child of current.children) {
			if (child.localName === localName) {
				found.push(child);
			}
			walk(child);
		}
	};
	walk(node);
	return found;
}

/**
 * The first descendant whose local name matches, or undefined.
 *
 * @param node The subtree root.
 * @param localName The unprefixed tag name to match.
 */
export function findFirst(node: IXmlNode, localName: string): IXmlNode | undefined {
	for (const child of node.children) {
		if (child.localName === localName) {
			return child;
		}
		const nested = findFirst(child, localName);
		if (nested) {
			return nested;
		}
	}
	return undefined;
}

/**
 * Reads an attribute by local name, so a part that writes `table:name` and one that writes
 * `name` both resolve.
 *
 * @param node The element.
 * @param localName The unprefixed attribute name.
 */
export function attribute(node: IXmlNode, localName: string): string | undefined {
	const direct = node.attributes[localName];
	if (direct !== undefined) {
		return direct;
	}
	for (const [key, value] of Object.entries(node.attributes)) {
		if (key.slice(key.indexOf(':') + 1) === localName) {
			return value;
		}
	}
	return undefined;
}

/**
 * Concatenates every text node in the subtree, in document order.
 *
 * `replacements` maps a local element name to the literal it stands for, which is how the
 * formats' non-text glyph elements come through: OpenDocument writes a tab as `<text:tab/>` and
 * a line break as `<text:line-break/>`, and PresentationML writes a break as `<a:br/>`. Without
 * this, `"Name\tRole"` would extract as `"NameRole"`.
 *
 * @param node The subtree root.
 * @param replacements Local element name → the text it contributes.
 * @returns The concatenated text.
 */
export function textContent(node: IXmlNode, replacements: Record<string, string> = {}): string {
	let text = '';
	const walk = (current: IXmlNode): void => {
		for (const item of current.content) {
			if (typeof item === 'string') {
				text += item;
				continue;
			}
			const replacement = replacements[item.localName];
			if (replacement !== undefined) {
				text += replacement;
			}
			walk(item);
		}
	};
	walk(node);
	return text;
}

/** Appends a text run to an element, ignoring the empty slices between adjacent tags. */
function appendText(node: IXmlNode, raw: string): void {
	if (!raw) return;
	node.content.push(decodeEntities(raw));
}

/** Index just past `terminator`, or the end of the document when it never closes. */
function skipTo(xml: string, from: number, terminator: string): number {
	const end = xml.indexOf(terminator, from);
	return end === -1 ? xml.length : end + terminator.length;
}

/**
 * Index just past a `<!DOCTYPE …>` declaration, INCLUDING a `[ … ]` internal subset.
 *
 * Skipping to the first `>` would stop inside the subset and leave its entity declarations to be
 * re-parsed as document content — which is exactly the shape an entity-expansion payload needs.
 */
function skipDoctype(xml: string, from: number): number {
	let depth = 0;
	for (let i = from; i < xml.length; i++) {
		const character = xml[i];
		if (character === '[') depth++;
		else if (character === ']') depth--;
		else if (character === '>' && depth <= 0) return i + 1;
	}
	return xml.length;
}

/**
 * Index of the `>` closing the tag that starts at `from`, ignoring any `>` inside a quoted
 * attribute value (`<a:hlinkClick r:id="a>b"/>` is legal XML).
 */
function findTagEnd(xml: string, from: number): number {
	let quote = '';
	for (let i = from + 1; i < xml.length; i++) {
		const character = xml[i];
		if (quote) {
			if (character === quote) quote = '';
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (character === '>') {
			return i;
		}
	}
	return -1;
}

/** Parses the inside of an opening tag into an element (name + attributes, no children yet). */
function parseTag(tag: string): IXmlNode {
	const trimmed = tag.trim();
	const nameEnd = trimmed.search(/[\s/]/);
	const name = nameEnd === -1 ? trimmed : trimmed.slice(0, nameEnd);
	const attributes: Record<string, string> = {};

	if (nameEnd !== -1) {
		const attributePattern = /([^\s=/]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
		let match: RegExpExecArray | null;
		while ((match = attributePattern.exec(trimmed)) !== null) {
			attributes[match[1]] = decodeEntities(match[3] ?? match[4] ?? '');
		}
	}

	return {
		name,
		localName: name.slice(name.indexOf(':') + 1),
		attributes,
		children: [],
		content: []
	};
}

/**
 * Decodes the five predefined entities and numeric character references.
 *
 * An unknown entity is left VERBATIM rather than dropped: `&myEntity;` in extracted text is a
 * visible oddity, whereas silently deleting it would corrupt the text with no trace.
 */
function decodeEntities(text: string): string {
	if (!text.includes('&')) {
		return text;
	}
	return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, entity: string) => {
		if (entity.startsWith('#x') || entity.startsWith('#X')) {
			return fromCodePoint(parseInt(entity.slice(2), 16), whole);
		}
		if (entity.startsWith('#')) {
			return fromCodePoint(parseInt(entity.slice(1), 10), whole);
		}
		return PREDEFINED_ENTITIES[entity] ?? whole;
	});
}

/** A numeric character reference, or the original text when it does not denote a character. */
function fromCodePoint(codePoint: number, whole: string): string {
	if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
		return whole;
	}
	try {
		return String.fromCodePoint(codePoint);
	} catch {
		return whole;
	}
}
