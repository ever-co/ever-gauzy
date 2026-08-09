/**
 * Canonical semantic form for legacy-HTML round-trip comparison
 * (05-editor-spec.md §3.6 compatibility contract, 06-ckeditor-removal.md §4.2/§4.4).
 *
 * This is the "normalize" step of **load → serialize → normalize → diff**: it reduces HTML
 * to the form both sides of the diff are compared in, removing only the differences the
 * compatibility contract explicitly tolerates.
 *
 * It is deliberately a plain module, not a spec helper, because two consumers must agree
 * on it byte for byte:
 *
 *   1. `legacy-html-corpus.spec.ts` — the CI regression suite over synthetic corpora.
 *   2. `tools/scripts/legacy-rich-text-audit.ts` — the §4.4 pre-removal gate over a
 *      production-representative snapshot.
 *
 * The audit must call "loss" exactly what the unit suite calls loss; if these two ever
 * canonicalized differently, the gate and the regression tests could silently disagree
 * about the one thing both exist to decide.
 */

/**
 * Deterministic string ordering for every sort in the canonicalization (and for any report
 * that has to be diffed between runs).
 *
 * `Array.prototype.sort()` with no comparator is flagged (rightly) as unreliable, but the usual
 * remedy — `localeCompare` — is the WRONG one here. Every sort below feeds either a canonical form
 * used to decide whether two HTML strings are equivalent, or a report meant to be diffed between
 * runs. `localeCompare` is locale-sensitive, so the same row could canonicalize differently on two
 * machines and manufacture a "loss" that does not exist. Code-unit order is stable everywhere.
 */
export const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Legacy tags TipTap canonicalizes to a single spelling; both sides get the canonical one. */
const TAG_ALIASES: Record<string, string> = {
	B: 'strong',
	I: 'em',
	STRIKE: 's',
	DEL: 's',
	DIV: 'p'
};

/** Structural attributes ProseMirror always writes out but that carry no author intent. */
const NOISE_ATTRIBUTES = new Set(['class', 'id', 'rel', 'data-pm-slice']);

/** Converts `rgb(r, g, b)` (what the DOM gives back for a hex colour) to `#rrggbb`. */
export function canonicalColor(value: string): string {
	return value.replace(
		/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)/gi,
		(_match, r, g, b) => `#${[r, g, b].map((part: string) => Number(part).toString(16).padStart(2, '0')).join('')}`
	);
}

/**
 * Canonicalizes an inline `style` attribute: drops the resizable-table `min-width`
 * scaffolding, normalizes colour notation and whitespace, and sorts declarations so
 * declaration order can never fail a diff.
 */
export function canonicalStyle(style: string): string {
	return (
		style
			.split(';')
			.map((declaration) => declaration.trim())
			.filter(Boolean)
			.map((declaration) => {
				const separator = declaration.indexOf(':');
				const property = declaration.slice(0, separator).trim().toLowerCase();
				const value = canonicalColor(
					declaration
						.slice(separator + 1)
						.trim()
						.toLowerCase()
				);
				return `${property}: ${value}`;
			})
			// TableKit's resize handles write min-width on the table and every <col>.
			.filter((declaration) => !declaration.startsWith('min-width:'))
			.sort(byCodeUnit)
			.join('; ')
	);
}

/** Recursively renames a tag, preserving children and attributes. */
function renameTags(root: Element, from: string, to: string): void {
	root.querySelectorAll(from.toLowerCase()).forEach((element) => {
		const replacement = element.ownerDocument.createElement(to);
		Array.from(element.attributes).forEach((attribute) =>
			replacement.setAttribute(attribute.name, attribute.value)
		);
		while (element.firstChild) {
			replacement.appendChild(element.firstChild);
		}
		element.replaceWith(replacement);
	});
}

/** Serializes an element tree with attributes in a stable (sorted) order. */
export function serialize(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		// Re-encode through a throwaway element so both sides use one entity spelling.
		const holder = node.ownerDocument!.createElement('span');
		holder.textContent = node.nodeValue ?? '';
		return holder.innerHTML;
	}
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return '';
	}
	const element = node as Element;
	const tag = element.tagName.toLowerCase();
	const attributes = Array.from(element.attributes)
		.filter((attribute) => !NOISE_ATTRIBUTES.has(attribute.name))
		.map((attribute) => {
			const value = attribute.name === 'style' ? canonicalStyle(attribute.value) : attribute.value;
			return { name: attribute.name, value };
		})
		.filter((attribute) => attribute.value !== '')
		// Attribute NAMES take the same code-unit ordering as everything else here. This was
		// `localeCompare` in both original copies, which quietly contradicted the rule above:
		// ICU collation is locale- and version-dependent, so two machines could order
		// `colspan` / `data-x` / `href` differently and manufacture a "loss" that is really
		// just a different attribute order. Safe to change — canonicalization is applied to
		// BOTH sides of every comparison, so a reordering shifts them identically and no
		// verdict moves.
		.sort((a, b) => byCodeUnit(a.name, b.name))
		.map((attribute) => ` ${attribute.name}="${attribute.value}"`)
		.join('');

	const children = Array.from(element.childNodes).map(serialize).join('');
	return `<${tag}${attributes}>${children}</${tag}>`;
}

/**
 * Reduces HTML to the canonical semantic form both sides of the diff are compared in,
 * removing only the differences the compatibility contract explicitly tolerates
 * ("attribute order/whitespace may differ, content and formatting may not"):
 * tag aliases, ProseMirror's table scaffolding, the `<p>` wrapper ProseMirror puts inside
 * list items and table cells, `colspan="1"`/`rowspan="1"`, colour notation, declaration
 * and attribute order. Anything else that differs is real content loss.
 *
 * Returns the canonical `<body>` so a caller can take both a census and a serialization
 * from one parse; `canonicalize()` below is the string-only form.
 */
export function canonicalBody(html: string): HTMLElement {
	const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
	const body = parsed.body;

	Object.entries(TAG_ALIASES).forEach(([from, to]) => renameTags(body, from, to));

	// `<pre>text</pre>` is stored as a code block, i.e. `<pre><code>text</code></pre>`.
	body.querySelectorAll('pre').forEach((pre) => {
		if (!pre.querySelector('code')) {
			const code = parsed.createElement('code');
			while (pre.firstChild) {
				code.appendChild(pre.firstChild);
			}
			pre.appendChild(code);
		}
	});

	// TableKit renders every row inside a single <tbody> and adds a <colgroup>.
	body.querySelectorAll('table').forEach((table) => {
		table.querySelectorAll('colgroup').forEach((colgroup) => colgroup.remove());
		const rows = Array.from(table.querySelectorAll('tr'));
		table.querySelectorAll('thead, tfoot, tbody').forEach((section) => section.remove());
		const tbody = parsed.createElement('tbody');
		rows.forEach((row) => tbody.appendChild(row));
		table.appendChild(tbody);
	});

	// The Link extension applies a uniform safety policy to every anchor: hardened `rel`
	// (stripped as noise during serialization) and `target="_blank"`. Both are additive — a
	// bare legacy `<a href>` gains them — so they are normalized away here and asserted on
	// their own in the construct-coverage and intentional-behaviour blocks of
	// `legacy-html-corpus.spec.ts`.
	body.querySelectorAll('a[target="_blank"]').forEach((anchor) => anchor.removeAttribute('target'));

	// Implicit spans are always written explicitly by ProseMirror.
	body.querySelectorAll('td, th').forEach((cell) => {
		['colspan', 'rowspan'].forEach((attribute) => {
			if (cell.getAttribute(attribute) === '1') {
				cell.removeAttribute(attribute);
			}
		});
	});

	// ProseMirror wraps list-item and table-cell content in a paragraph.
	body.querySelectorAll('li > p:only-child, td > p:only-child, th > p:only-child').forEach((paragraph) => {
		paragraph.replaceWith(...Array.from(paragraph.childNodes));
	});
	// A list item whose first child is a paragraph followed by a nested list.
	body.querySelectorAll('li > p:first-child').forEach((paragraph) => {
		paragraph.replaceWith(...Array.from(paragraph.childNodes));
	});

	return body;
}

/** Serializes a canonical `<body>` (as returned by `canonicalBody`) to its canonical string. */
export const serializeBody = (body: HTMLElement): string => Array.from(body.childNodes).map(serialize).join('');

/**
 * String form of the canonicalization: `serializeBody(canonicalBody(html))`.
 *
 * Two HTML strings are equivalent — "no content loss" — exactly when their `canonicalize()`
 * outputs are identical.
 */
export function canonicalize(html: string): string {
	return serializeBody(canonicalBody(html));
}
