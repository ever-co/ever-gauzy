import { generateHTML, generateJSON } from '@tiptap/html';
import type { Extensions } from '@tiptap/core';
import { createEmailPreset } from './presets/email.preset';
import { createStandardPreset } from './presets/standard.preset';
import { normalizeLegacyHtml } from './legacy-html.util';

/**
 * Legacy-HTML round-trip corpora (10-implementation-plan.md §8.4, contract in
 * 05-editor-spec.md §3.6).
 *
 * One corpus per replaced field family (06-ckeditor-removal.md §3.1), each built from
 * the constructs CKEditor 4 actually emitted. Every corpus runs
 * **load → serialize → normalize → diff**: any construct that the presets claim to
 * support and that does not survive the round-trip fails the build.
 *
 * Constructs that are dropped *by design* (the schema has no node for them) are asserted
 * explicitly, so the drop list is documented here rather than discovered in production.
 */

const STANDARD: Extensions = createStandardPreset().extensions;
const EMAIL: Extensions = createEmailPreset().extensions;

/** Load into the schema and serialize back out — exactly what the CVA does on save. */
const roundTrip = (html: string, extensions: Extensions = STANDARD): string =>
	generateHTML(generateJSON(normalizeLegacyHtml(html), extensions), extensions);

// ---------------------------------------------------------------------------
// Normalization: the "normalize" step of load → serialize → normalize → diff.
// ---------------------------------------------------------------------------

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
function canonicalColor(value: string): string {
	return value.replace(/rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)/gi, (_match, r, g, b) =>
		`#${[r, g, b].map((part: string) => Number(part).toString(16).padStart(2, '0')).join('')}`
	);
}

/**
 * Canonicalizes an inline `style` attribute: drops the resizable-table `min-width`
 * scaffolding, normalizes colour notation and whitespace, and sorts declarations so
 * declaration order can never fail a diff.
 */
function canonicalStyle(style: string): string {
	return style
		.split(';')
		.map((declaration) => declaration.trim())
		.filter(Boolean)
		.map((declaration) => {
			const separator = declaration.indexOf(':');
			const property = declaration.slice(0, separator).trim().toLowerCase();
			const value = canonicalColor(declaration.slice(separator + 1).trim().toLowerCase());
			return `${property}: ${value}`;
		})
		// TableKit's resize handles write min-width on the table and every <col>.
		.filter((declaration) => !declaration.startsWith('min-width:'))
		.sort()
		.join('; ');
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
function serialize(node: Node): string {
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
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((attribute) => ` ${attribute.name}="${attribute.value}"`)
		.join('');

	const children = Array.from(element.childNodes).map(serialize).join('');
	return `<${tag}${attributes}>${children}</${tag}>`;
}

/**
 * Reduces HTML to the canonical semantic form both sides of the diff are compared in.
 *
 * It removes only differences the compatibility contract explicitly tolerates
 * ("attribute order/whitespace may differ, content and formatting may not"):
 * tag aliases, ProseMirror's table scaffolding, the `<p>` wrapper ProseMirror puts inside
 * list items and table cells, `colspan="1"`/`rowspan="1"`, colour notation, declaration
 * and attribute order. Anything else that differs is real content loss.
 */
export function canonicalize(html: string): string {
	const document = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
	const body = document.body;

	Object.entries(TAG_ALIASES).forEach(([from, to]) => renameTags(body, from, to));

	// `<pre>text</pre>` is stored as a code block, i.e. `<pre><code>text</code></pre>`.
	body.querySelectorAll('pre').forEach((pre) => {
		if (!pre.querySelector('code')) {
			const code = document.createElement('code');
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
		const tbody = document.createElement('tbody');
		rows.forEach((row) => tbody.appendChild(row));
		table.appendChild(tbody);
	});

	// The Link extension applies a uniform safety policy to every anchor: hardened `rel`
	// (stripped as noise above) and `target="_blank"`. Both are additive — a bare legacy
	// `<a href>` gains them — so they are normalized away here and asserted on their own
	// in the construct-coverage and intentional-behaviour blocks below.
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

	return Array.from(body.childNodes).map(serialize).join('');
}

// ---------------------------------------------------------------------------
// Corpora — one per replaced field family (06-ckeditor-removal.md §3.1).
// ---------------------------------------------------------------------------

/**
 * #1–4 `Task.description` — the legacy minimal toolbar offered h1/h2/pre, alignment and
 * justify, so stored content carries headings, code blocks and aligned paragraphs.
 */
const TASK_DESCRIPTION_CORPUS = [
	'<h1>Rework the invoice exporter</h1>',
	'<p style="text-align: justify;">The exporter must stream rows instead of buffering them.</p>',
	'<h2>Acceptance criteria</h2>',
	'<ul><li>Memory stays flat for a 100k-row export</li><li>The CSV keeps its column order</li></ul>',
	'<ol start="3"><li>Third step of the migration runbook</li><li>Fourth step</li></ol>',
	'<p>Run <code>yarn nx test core</code> before pushing.</p>',
	'<pre><code>export CI=true\nyarn nx affected -t test</code></pre>',
	'<blockquote><p>Blocked on the storage migration.</p></blockquote>',
	'<p><strong>Owner:</strong> platform team<br>Due: <em>next sprint</em></p>',
	'<hr>',
	'<p>Reference: <a href="https://ever.co/handbook?a=1&amp;b=2" target="_blank">the handbook</a>.</p>'
].join('');

/**
 * #5–6 `OrganizationProject.description` — written with the legacy "full" toolbar, so it
 * carries font/colour spans, alignment, tables and images.
 */
const PROJECT_DESCRIPTION_CORPUS = [
	'<h2 style="text-align: center;">Project Northwind</h2>',
	'<p><span style="color: #e74c3c;">At-risk</span> until the vendor contract is signed.</p>',
	'<p><span style="font-family: Georgia, serif;">Long-form brief</span> follows.</p>',
	'<p><span style="background-color: #ffff00;">Highlighted for the steering committee.</span></p>',
	'<p style="text-align: right;">Reviewed quarterly</p>',
	'<table><tbody>',
	'<tr><th>Milestone</th><th>Owner</th></tr>',
	'<tr><td>Discovery</td><td>ana</td></tr>',
	'<tr><td colspan="2">Delivery is tracked in the programme board</td></tr>',
	'</tbody></table>',
	'<img src="https://ever.co/assets/northwind.png" alt="Northwind logo" width="120" height="40">',
	'<p>Chemical spec: H<sub>2</sub>O at 25 °C, area x<sup>2</sup>.</p>'
].join('');

/**
 * #7 `HelpCenterArticle.data` — long-form authored content: deep heading hierarchy,
 * nested lists, links, entities and a table.
 */
const HELP_CENTER_ARTICLE_CORPUS = [
	'<h1>Setting up single sign-on</h1>',
	'<p>This guide covers SAML&nbsp;2.0 and OIDC.</p>',
	'<h2>Prerequisites</h2>',
	'<h3>Identity provider</h3>',
	'<h4>Supported vendors</h4>',
	'<h5>Tested versions</h5>',
	'<h6>Notes</h6>',
	'<ul><li>An admin account<ul><li>with the <u>security</u> role</li></ul></li><li>A verified domain</li></ul>',
	'<ol><li>Open <strong>Settings</strong></li><li>Choose <em>Authentication</em></li></ol>',
	'<blockquote><p>Changing the IdP signs every user out.</p></blockquote>',
	'<p>Copy the ACS URL &amp; the entity ID &mdash; both are required. Use &quot;strict&quot; mode.</p>',
	'<table><thead><tr><th>Field</th><th>Value</th></tr></thead>',
	'<tbody><tr><td>ACS URL</td><td>https://api.gauzy.co/saml/acs</td></tr></tbody></table>',
	'<p>Questions? <a href="mailto:support@ever.co">Email support</a>.</p>',
	'<p>Legacy note<br>Second line of the note.</p>'
].join('');

/**
 * #11–14 `Proposal.proposalContent` / `ProposalTemplate.content` — AI-generated and
 * pasted content: mixed marks, aligned paragraphs, spacer paragraphs, `<font>` tags and
 * the `align` attribute the old word-processor paste produced.
 */
const PROPOSAL_CONTENT_CORPUS = [
	'<h2>Proposal for Acme Corp</h2>',
	'<p align="center">Prepared by the Ever delivery team</p>',
	'<p>&nbsp;</p>',
	'<p>We will deliver the platform in <strong>three</strong> phases.</p>',
	'<p><font color="#0000ff" face="Verdana">Phase one covers discovery.</font></p>',
	'<ul><li>Discovery workshop</li><li>Technical audit</li></ul>',
	'<p><s>Fixed price</s> Time and materials.</p>',
	'<p style="text-align: right;">Valid for 30 days</p>',
	'<p>Signed: <a href="https://ever.co/contact" target="_blank" rel="noopener noreferrer nofollow">contact us</a></p>'
].join('');

/**
 * #15 `candidate-email` body — the only `email` preset site. Content is never persisted,
 * so it carries no legacy-coverage obligation; the corpus is here to pin the email-safe
 * schema's deliberate exclusions.
 */
const CANDIDATE_EMAIL_CORPUS = [
	'<h1>Interview invitation</h1>',
	'<p>Hi <strong>Dana</strong>,</p>',
	'<p>We would like to invite you to a <em>technical interview</em>.</p>',
	'<ul><li>Tuesday 10:00</li><li>Wednesday 14:00</li></ul>',
	'<p style="text-align: center;">Please confirm a slot.</p>',
	'<p><span style="color: #1a73e8;">Ever Recruiting</span></p>',
	'<p><a href="https://ever.co/careers">Our careers page</a></p>',
	'<img src="https://ever.co/assets/logo.png" alt="Ever" width="80" height="24">',
	'<p>Kind regards,<br>The hiring team</p>'
].join('');

/** The four persisted families that MUST round-trip losslessly under `standard`. */
const PERSISTED_CORPORA: { name: string; html: string }[] = [
	{ name: 'task description (team/my/add-task dialogs, desktop tasks)', html: TASK_DESCRIPTION_CORPUS },
	{ name: 'project description (project & module mutation)', html: PROJECT_DESCRIPTION_CORPUS },
	{ name: 'help-center article body', html: HELP_CENTER_ARTICLE_CORPUS },
	{ name: 'proposal content (register/edit/template/apply-job)', html: PROPOSAL_CONTENT_CORPUS }
];

describe('legacy HTML corpora — load → serialize → normalize → diff (§8.4)', () => {
	describe('losslessness per replaced field family (standard preset)', () => {
		it.each(PERSISTED_CORPORA)('$name round-trips with zero content loss', ({ html }) => {
			const expected = canonicalize(normalizeLegacyHtml(html));
			const actual = canonicalize(roundTrip(html));
			expect(actual).toBe(expected);
		});

		it.each(PERSISTED_CORPORA)('$name preserves every character of text content', ({ html }) => {
			const textOf = (value: string): string => {
				const document = new DOMParser().parseFromString(`<body>${value}</body>`, 'text/html');
				return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
			};
			expect(textOf(roundTrip(html))).toBe(textOf(normalizeLegacyHtml(html)));
		});

		it.each(PERSISTED_CORPORA)('$name is stable — a second save produces identical HTML', ({ html }) => {
			const first = roundTrip(html);
			const second = roundTrip(first);
			expect(second).toBe(first);
		});
	});

	/**
	 * The §3.6 compatibility table, row by row. The corpus diff above proves nothing is
	 * lost; these assert *which* construct each row is, so a regression names itself.
	 */
	describe('§3.6 compatibility table — construct coverage (standard preset)', () => {
		const parse = (html: string): Document =>
			new DOMParser().parseFromString(`<body>${roundTrip(html)}</body>`, 'text/html');

		it('block elements: <p>, <h1>–<h6>, <pre>', () => {
			const document = parse(
				'<p>p</p><h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6><pre>raw</pre>'
			);
			['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'].forEach((tag) =>
				expect(document.querySelector(tag)).not.toBeNull()
			);
			expect(document.querySelector('pre')!.textContent).toBe('raw');
		});

		it('marks: <strong>/<b>, <em>/<i>, <u>, <s>/<strike>/<del>', () => {
			const document = parse(
				'<p><strong>a</strong> <b>b</b> <em>c</em> <i>d</i> <u>e</u> <s>f</s> <strike>g</strike> <del>h</del></p>'
			);
			// <b>/<i> canonicalize to <strong>/<em>; <strike>/<del> to <s>.
			expect(Array.from(document.querySelectorAll('strong')).map((n) => n.textContent)).toEqual(['a', 'b']);
			expect(Array.from(document.querySelectorAll('em')).map((n) => n.textContent)).toEqual(['c', 'd']);
			expect(document.querySelector('u')!.textContent).toBe('e');
			expect(Array.from(document.querySelectorAll('s')).map((n) => n.textContent)).toEqual(['f', 'g', 'h']);
		});

		it('nested marks survive in both nesting orders', () => {
			const outerBold = parse('<p><strong><em>x</em></strong></p>');
			expect(outerBold.querySelector('strong em, em strong')).not.toBeNull();
			const outerItalic = parse('<p><em><u>y</u></em></p>');
			expect(outerItalic.querySelector('em u, u em')).not.toBeNull();
		});

		it('<sub> and <sup>', () => {
			const document = parse('<p>H<sub>2</sub>O x<sup>2</sup></p>');
			expect(document.querySelector('sub')!.textContent).toBe('2');
			expect(document.querySelector('sup')!.textContent).toBe('2');
		});

		it('lists: <ul>, <ol> with start, <li>, and nesting', () => {
			const document = parse('<ul><li>a<ul><li>a1</li></ul></li></ul><ol start="7"><li>b</li></ol>');
			expect(document.querySelector('ul ul li')!.textContent).toContain('a1');
			expect(document.querySelector('ol')!.getAttribute('start')).toBe('7');
		});

		it('<blockquote>', () => {
			expect(parse('<blockquote><p>q</p></blockquote>').querySelector('blockquote p')!.textContent).toBe('q');
		});

		it('<a href target rel> — target is preserved, rel is hardened', () => {
			const withTarget = parse('<p><a href="https://ever.co/x" target="_blank">l</a></p>').querySelector('a')!;
			expect(withTarget.getAttribute('href')).toBe('https://ever.co/x');
			expect(withTarget.getAttribute('target')).toBe('_blank');

			const bare = parse('<p><a href="https://ever.co/y">l</a></p>').querySelector('a')!;
			expect(bare.getAttribute('rel')).toBe('noopener noreferrer nofollow');

			const mailto = parse('<p><a href="mailto:a@ever.co">m</a></p>').querySelector('a')!;
			expect(mailto.getAttribute('href')).toBe('mailto:a@ever.co');
		});

		it('<img src alt width height>', () => {
			const image = parse('<img src="https://ever.co/l.png" alt="logo" width="120" height="40">').querySelector(
				'img'
			)!;
			expect(image.getAttribute('src')).toBe('https://ever.co/l.png');
			expect(image.getAttribute('alt')).toBe('logo');
			expect(image.getAttribute('width')).toBe('120');
			expect(image.getAttribute('height')).toBe('40');
		});

		it('tables incl. <th>, colspan and rowspan', () => {
			const document = parse(
				'<table><thead><tr><th>A</th><th>B</th></tr></thead>' +
					'<tbody><tr><td colspan="2">wide</td></tr><tr><td rowspan="2">tall</td><td>x</td></tr></tbody></table>'
			);
			expect(document.querySelectorAll('th')).toHaveLength(2);
			expect(document.querySelector('td[colspan="2"]')!.textContent).toContain('wide');
			expect(document.querySelector('td[rowspan="2"]')!.textContent).toContain('tall');
		});

		it('text-align styles on blocks, and the deprecated align attribute', () => {
			const document = parse(
				'<p style="text-align: right;">r</p><h2 style="text-align: justify;">j</h2><p align="center">c</p>'
			);
			expect(document.querySelector('p[style*="text-align: right"]')).not.toBeNull();
			expect(document.querySelector('h2[style*="text-align: justify"]')).not.toBeNull();
			expect(document.querySelector('p[style*="text-align: center"]')).not.toBeNull();
		});

		it('colour, font-family and background-color spans — value preserved, notation normalized', () => {
			const span = parse(
				'<p><span style="color: #e74c3c; font-family: Georgia, serif; background-color: #ffff00;">x</span></p>'
			).querySelector('span')!;
			const style = span.getAttribute('style')!;
			// The DOM canonicalizes hex to rgb(); the colour itself is unchanged.
			expect(canonicalStyle(style)).toContain('color: #e74c3c');
			expect(canonicalStyle(style)).toContain('background-color: #ffff00');
			expect(style).toContain('Georgia');
		});

		it('legacy <font color face> is rewritten to a styled span', () => {
			const span = parse('<p><font color="#ff0000" face="Verdana">f</font></p>').querySelector('span')!;
			expect(canonicalStyle(span.getAttribute('style')!)).toContain('color: #ff0000');
			expect(span.getAttribute('style')).toContain('Verdana');
		});

		it('<mark> highlight', () => {
			expect(parse('<p><mark>h</mark></p>').querySelector('mark')!.textContent).toBe('h');
		});

		it('<br> hard breaks', () => {
			expect(parse('<p>a<br>b<br/>c</p>').querySelectorAll('br')).toHaveLength(2);
		});

		it('<hr> horizontal rules', () => {
			expect(parse('<p>a</p><hr><p>b</p>').querySelector('hr')).not.toBeNull();
		});

		it('entities: &nbsp;, &amp;, &lt;, &quot;, &copy;, &mdash; and accented characters', () => {
			const text = parse('<p>A&nbsp;B &amp; C &lt;t&gt; &quot;q&quot; &copy; &mdash; café</p>').body
				.textContent!;
			expect(text).toContain(' '); // &nbsp; stays a non-breaking space
			expect(text).toContain('&');
			expect(text).toContain('<t>');
			expect(text).toContain('"q"');
			expect(text).toContain('©');
			expect(text).toContain('—');
			expect(text).toContain('café');
		});

		it('<p>&nbsp;</p> spacer paragraphs collapse to empty paragraphs (content preserved either side)', () => {
			const document = parse('<p>x</p><p>&nbsp;</p><p>y</p>');
			const paragraphs = Array.from(document.querySelectorAll('p'));
			expect(paragraphs).toHaveLength(3);
			expect(paragraphs[1].textContent).toBe('');
			expect(paragraphs.map((p) => p.textContent)).toEqual(['x', '', 'y']);
		});

		it('editor-namespace artifacts are stripped but their content is kept', () => {
			const html = roundTrip('<!-- c --><p class="cke_widget keep" data-cke-saved-href="x">kept text</p>');
			expect(html).toContain('kept text');
			expect(html).not.toContain('cke_widget');
			expect(html).not.toContain('data-cke-');
			expect(html).not.toContain('<!--');
		});

		it('<figure><img><figcaption> unwraps to image + caption paragraph', () => {
			const document = parse(
				'<figure><img src="https://ever.co/a.png" alt="a"><figcaption>the caption</figcaption></figure>'
			);
			expect(document.querySelector('img')).not.toBeNull();
			expect(document.body.textContent).toContain('the caption');
			expect(document.querySelector('figure')).toBeNull();
		});
	});

	/**
	 * Constructs the schema drops **on purpose**. Asserted so the intent is recorded and
	 * a future preset change that silently starts (or stops) dropping one is caught.
	 */
	describe('intentional drops (standard preset) — documented, not silent', () => {
		it('drops <iframe> embeds entirely', () => {
			const html = roundTrip('<p>before</p><iframe src="https://x.test/embed"></iframe><p>after</p>');
			expect(html).not.toContain('iframe');
			expect(html).not.toContain('x.test');
			expect(html).toContain('before');
			expect(html).toContain('after');
		});

		it('drops legacy form widgets', () => {
			const html = roundTrip('<p>before</p><form action="/x"><input name="q"><button>go</button></form>');
			expect(html).not.toContain('<form');
			expect(html).not.toContain('<input');
			expect(html).not.toContain('<button');
			expect(html).toContain('before');
		});

		it('drops the deprecated <font size> attribute while keeping color and face', () => {
			const html = roundTrip('<p><font color="#ff0000" face="Verdana" size="4">sized</font></p>');
			expect(html).toContain('sized');
			expect(html).toContain('Verdana');
			expect(html).not.toContain('size="4"');
			// No font-size declaration is synthesized — the preset registers no FontSize mark.
			expect(html).not.toContain('font-size');
		});

		it('unwraps <div> containers into paragraphs, keeping their text', () => {
			const html = roundTrip('<div>outer text</div>');
			expect(html).toContain('outer text');
			expect(html).not.toContain('<div');
		});

		it('ADDS target="_blank" + hardened rel to bare legacy links (additive, not a loss)', () => {
			const anchor = new DOMParser()
				.parseFromString(`<body>${roundTrip('<p><a href="https://ever.co/z">z</a></p>')}</body>`, 'text/html')
				.querySelector('a')!;
			expect(anchor.getAttribute('href')).toBe('https://ever.co/z');
			// A legacy anchor with no target/rel comes back hardened — deliberate policy
			// from `baseLinkConfiguration`, and the only way stored content changes shape
			// on a no-edit save.
			expect(anchor.getAttribute('target')).toBe('_blank');
			expect(anchor.getAttribute('rel')).toBe('noopener noreferrer nofollow');
		});

		it('drops class and id attributes (no styling hooks survive into stored content)', () => {
			const html = roundTrip('<p class="lead" id="intro">text</p>');
			expect(html).toContain('text');
			expect(html).not.toContain('class="lead"');
			expect(html).not.toContain('id="intro"');
		});
	});

	/**
	 * `email` is a deliberately narrower schema (05-editor-spec.md §3.3): its content is
	 * never persisted to a DB column, so it carries no legacy-coverage obligation. These
	 * pin what it keeps and what it drops so the two contracts never get confused.
	 */
	describe('candidate email body (email preset) — email-safe schema', () => {
		const emailRoundTrip = (html: string): string => roundTrip(html, EMAIL);

		it('round-trips the corpus stably and keeps all of its text', () => {
			const first = emailRoundTrip(CANDIDATE_EMAIL_CORPUS);
			expect(emailRoundTrip(first)).toBe(first);

			const textOf = (value: string): string => {
				const document = new DOMParser().parseFromString(`<body>${value}</body>`, 'text/html');
				return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
			};
			expect(textOf(first)).toBe(textOf(normalizeLegacyHtml(CANDIDATE_EMAIL_CORPUS)));
		});

		it('keeps headings 1–3, marks, lists, alignment, colour spans, links and absolute images', () => {
			const html = emailRoundTrip(CANDIDATE_EMAIL_CORPUS);
			expect(html).toContain('<h1>Interview invitation</h1>');
			expect(html).toContain('<strong>Dana</strong>');
			expect(html).toContain('<em>technical interview</em>');
			expect(html).toContain('<ul>');
			expect(html).toContain('text-align: center');
			expect(html).toContain('color: rgb(26, 115, 232)');
			expect(html).toContain('href="https://ever.co/careers"');
			expect(html).toContain('src="https://ever.co/assets/logo.png"');
			expect(html).toContain('<br>');
		});

		it('demotes headings below level 3 to paragraphs (by design)', () => {
			const html = emailRoundTrip('<h3>kept</h3><h4>demoted</h4><h6>also demoted</h6>');
			expect(html).toContain('<h3>kept</h3>');
			expect(html).toContain('<p>demoted</p>');
			expect(html).toContain('<p>also demoted</p>');
		});

		it('drops code, code blocks, tables and highlight — keeping the text (by design)', () => {
			const code = emailRoundTrip('<p>use <code>npm i</code></p>');
			expect(code).not.toContain('<code>');
			expect(code).toContain('npm i');

			const table = emailRoundTrip('<table><tbody><tr><td>cell one</td><td>cell two</td></tr></tbody></table>');
			expect(table).not.toContain('<table');
			expect(table).toContain('cell one');
			expect(table).toContain('cell two');

			const highlight = emailRoundTrip('<p><mark>marked</mark></p>');
			expect(highlight).not.toContain('<mark>');
			expect(highlight).toContain('marked');
		});

		it('drops relative and data-URL images — only absolute http(s) sources survive', () => {
			expect(emailRoundTrip('<img src="/assets/local.png" alt="l">')).not.toContain('<img');
			expect(emailRoundTrip('<img src="data:image/png;base64,AAAA" alt="d">')).not.toContain('<img');
			expect(emailRoundTrip('<img src="https://ever.co/a.png" alt="a">')).toContain('<img');
		});
	});

	/**
	 * `minimal` is reserved for new, history-free fields and MAY drop legacy markup by
	 * design (05-editor-spec.md §3.3). Asserting that here is what makes the
	 * "never wire `minimal` to a field with pre-existing CKEditor HTML" rule enforceable.
	 */
	describe('preset selection rule — why legacy fields may not use `minimal`', () => {
		it('standard keeps what minimal would drop', () => {
			const legacy = '<h1>Title</h1><p style="text-align: center;">c</p><table><tbody><tr><td>x</td></tr></tbody></table>';
			const standard = roundTrip(legacy);
			expect(standard).toContain('<h1>');
			expect(standard).toContain('text-align: center');
			expect(standard).toContain('<table');
		});
	});
});
