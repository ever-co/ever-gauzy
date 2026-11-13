// cspell:ignore subsup
import { AdfDocument, AdfNode, adfToHtml, adfToText, canonicalHtml, decodeEntities, htmlToAdf, parseHtml, safeHref, textToAdf } from './jira-adf';

const doc = (...content: AdfNode[]): AdfDocument => ({ type: 'doc', version: 1, content });
const p = (...content: AdfNode[]): AdfNode => ({ type: 'paragraph', content });
const text = (value: string, ...marks: Array<string | { type: string; attrs?: Record<string, unknown> }>): AdfNode => ({
	type: 'text',
	text: value,
	...(marks.length ? { marks: marks.map((mark) => (typeof mark === 'string' ? { type: mark } : mark)) } : {})
});

describe('ADF → HTML', () => {
	it('writes the blocks the task store keeps: paragraphs, headings, lists, code, quotes, rules and tables', () => {
		const html = adfToHtml(
			doc(
				{ type: 'heading', attrs: { level: 2 }, content: [text('Plan')] },
				p(text('First '), text('bold', 'strong'), text(' and '), text('code', 'code')),
				{ type: 'bulletList', content: [{ type: 'listItem', content: [p(text('one'))] }, { type: 'listItem', content: [p(text('two'))] }] },
				{ type: 'orderedList', attrs: { order: 3 }, content: [{ type: 'listItem', content: [p(text('three'))] }] },
				{ type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1 < 2;\nreturn a;')] },
				{ type: 'blockquote', content: [p(text('quoted'))] },
				{ type: 'rule' },
				{
					type: 'table',
					content: [
						{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(text('H'))] }, { type: 'tableHeader', attrs: { colspan: 2 }, content: [p(text('I'))] }] },
						{ type: 'tableRow', content: [{ type: 'tableCell', content: [p(text('c'))] }] }
					]
				}
			)
		);
		expect(html).toBe(
			'<h2>Plan</h2><p>First <strong>bold</strong> and <code>code</code></p><ul><li><p>one</p></li><li><p>two</p></li></ul>' +
				'<ol start="3"><li><p>three</p></li></ol><pre><code>const a = 1 &lt; 2;\nreturn a;</code></pre><blockquote><p>quoted</p></blockquote><hr>' +
				'<table><tbody><tr><th><p>H</p></th><th colspan="2"><p>I</p></th></tr><tr><td><p>c</p></td></tr></tbody></table>'
		);
	});

	it('escapes every text, and nests the marks in one order whatever order Jira lists them in', () => {
		expect(adfToHtml(doc(p(text('<script>alert("x")</script> & co', 'em', 'strong'))))).toBe(
			'<p><strong><em>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</em></strong></p>'
		);
	});

	it('keeps an http(s), mailto or tel link only, and drops the link of any other address (its text stays)', () => {
		const link = (href: string) => ({ type: 'link', attrs: { href } });
		expect(adfToHtml(doc(p(text('site', link('https://example.com/a?b=1&c=2')))))).toBe('<p><a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">site</a></p>');
		expect(adfToHtml(doc(p(text('mail', link('mailto:a@example.com')))))).toContain('href="mailto:a@example.com"');
		expect(adfToHtml(doc(p(text('evil', link('javascript:alert(1)')))))).toBe('<p>evil</p>');
		expect(adfToHtml(doc(p(text('rel', link('/relative')))))).toBe('<p>rel</p>');
		expect(safeHref(' data:text/html,x')).toBeNull();
	});

	it('keeps only a link beside a code mark (ADF allows no other)', () => {
		expect(adfToHtml(doc(p(text('x', 'strong', 'code', { type: 'link', attrs: { href: 'https://e.io' } }))))).toBe(
			'<p><a href="https://e.io" rel="noopener noreferrer"><code>x</code></a></p>'
		);
	});

	it('reads the inline nodes that carry text of their own, and leaves media out (attachments come as links)', () => {
		const html = adfToHtml(
			doc(
				p(
					{ type: 'mention', attrs: { id: 'acc', text: '@Ada' } },
					text(' '),
					{ type: 'emoji', attrs: { shortName: ':tada:', text: '🎉' } },
					{ type: 'hardBreak' },
					{ type: 'status', attrs: { text: 'DONE' } },
					text(' '),
					{ type: 'date', attrs: { timestamp: String(Date.UTC(2026, 10, 11)) } },
					text(' '),
					{ type: 'inlineCard', attrs: { url: 'https://example.atlassian.net/browse/A-1' } }
				),
				{ type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'm', type: 'file' } }] }
			)
		);
		expect(html).toBe(
			'<p>@Ada 🎉<br>DONE 2026-11-11 <a href="https://example.atlassian.net/browse/A-1" rel="noopener noreferrer">https://example.atlassian.net/browse/A-1</a></p>'
		);
	});

	it('answers null for no document and for one with nothing to show', () => {
		expect(adfToHtml(null)).toBeNull();
		expect(adfToHtml(doc())).toBeNull();
		expect(adfToHtml(doc(p()))).toBeNull();
		expect(adfToHtml(doc({ type: 'mediaSingle', content: [] }))).toBeNull();
		expect(adfToHtml(doc({ type: 'rule' }))).toBe('<hr>');
	});

	it('reads task lists, panels and expands as the blocks the task store has', () => {
		expect(
			adfToHtml(
				doc(
					{ type: 'taskList', content: [{ type: 'taskItem', attrs: { state: 'DONE' }, content: [text('ship')] }, { type: 'taskItem', attrs: { state: 'TODO' }, content: [text('test')] }] },
					{ type: 'panel', attrs: { panelType: 'info' }, content: [p(text('note'))] },
					{ type: 'expand', attrs: { title: 'More' }, content: [p(text('hidden'))] }
				)
			)
		).toBe('<ul><li><p>[x] ship</p></li><li><p>[ ] test</p></li></ul><blockquote><p>note</p></blockquote><p><strong>More</strong></p><p>hidden</p>');
	});

	it('reads a document as text alone', () => {
		expect(adfToText(doc(p(text('Hello '), { type: 'mention', attrs: { text: 'Ada' } }), p(text('Bye'))))).toBe('Hello @Ada\nBye');
	});
});

describe('HTML → ADF', () => {
	it('reads the editor subset back into blocks and marks', () => {
		expect(htmlToAdf('<h1>T</h1><p>a <strong>b</strong> <em>c</em> <u>d</u> <s>e</s> <sub>f</sub><sup>g</sup><br>h</p>')).toEqual(
			doc(
				{ type: 'heading', attrs: { level: 1 }, content: [text('T')] },
				p(
					text('a '),
					text('b', 'strong'),
					text(' '),
					text('c', 'em'),
					text(' '),
					text('d', 'underline'),
					text(' '),
					text('e', 'strike'),
					text(' '),
					text('f', { type: 'subsup', attrs: { type: 'sub' } }),
					text('g', { type: 'subsup', attrs: { type: 'sup' } }),
					{ type: 'hardBreak' },
					text('h')
				)
			)
		);
	});

	it('starts every list item with a paragraph, and keeps a nested list inside its item', () => {
		expect(htmlToAdf('<ul><li>loose</li><li><p>a</p><ol start="2"><li><p>b</p></li></ol></li></ul>')).toEqual(
			doc({
				type: 'bulletList',
				content: [
					{ type: 'listItem', content: [p(text('loose'))] },
					{ type: 'listItem', content: [p(text('a')), { type: 'orderedList', attrs: { order: 2 }, content: [{ type: 'listItem', content: [p(text('b'))] }] }] }
				]
			})
		);
	});

	it('decodes entities, keeps code text as it is, and links only safe addresses', () => {
		expect(htmlToAdf('<pre><code>a &lt; b &amp;&amp; c</code></pre><p><a href="javascript:x()">no</a> <a href="https://e.io/?a=1&amp;b=2">yes</a></p>')).toEqual(
			doc({ type: 'codeBlock', content: [text('a < b && c')] }, p(text('no '), text('yes', { type: 'link', attrs: { href: 'https://e.io/?a=1&b=2' } })))
		);
	});

	it('drops what is not text of the document (scripts, styles, frames) and any unknown tag, keeping its text', () => {
		expect(htmlToAdf('<p>a<script>alert(1)</script><span style="color:red">b</span><marquee>c</marquee></p><style>p{}</style><iframe src="x"></iframe>')).toEqual(doc(p(text('abc'))));
	});

	it('reads inline content at the top level as a paragraph, and survives broken markup', () => {
		expect(htmlToAdf('plain <b>bold')).toEqual(doc(p(text('plain '), text('bold', 'strong'))));
		expect(htmlToAdf('<p>a</div></p><p>b < c</p>')).toEqual(doc(p(text('a')), p(text('b < c'))));
	});

	it('answers null for an empty description (it clears the issue’s)', () => {
		expect(htmlToAdf('')).toBeNull();
		expect(htmlToAdf(null)).toBeNull();
		expect(htmlToAdf('<p></p><p>&nbsp;</p>')).toBeNull();
	});

	it('keeps no heading or rule inside a quote (ADF has none there)', () => {
		expect(htmlToAdf('<blockquote><h2>Head</h2><p>body</p><hr></blockquote>')).toEqual(doc({ type: 'blockquote', content: [p(text('Head', 'strong')), p(text('body'))] }));
	});

	it('keeps the words of a block a list item or a quote may not hold in ADF, as a paragraph of its text', () => {
		expect(htmlToAdf('<ul><li><h3>Steps</h3></li></ul>')).toEqual(doc({ type: 'bulletList', content: [{ type: 'listItem', content: [p(text('Steps'))] }] }));
		expect(htmlToAdf('<blockquote><blockquote><p>inner</p><p>quote</p></blockquote></blockquote>')).toEqual(
			doc({ type: 'blockquote', content: [p(text('inner'), { type: 'hardBreak' }, text('quote'))] })
		);
		// A rule has no words: it goes.
		expect(htmlToAdf('<ul><li><p>a</p><hr></li></ul>')).toEqual(doc({ type: 'bulletList', content: [{ type: 'listItem', content: [p(text('a'))] }] }));
	});

	it('reads tables with their header cells and spans', () => {
		expect(htmlToAdf('<table><tbody><tr><th colspan="2"><p>H</p></th></tr><tr><td>x</td><td></td></tr></tbody></table>')).toEqual(
			doc({
				type: 'table',
				content: [
					{ type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 2 }, content: [p(text('H'))] }] },
					{ type: 'tableRow', content: [{ type: 'tableCell', content: [p(text('x'))] }, { type: 'tableCell', content: [{ type: 'paragraph' }] }] }
				]
			})
		);
	});

	it('parses forgivingly and decodes numeric entities', () => {
		expect(parseHtml('<p>a<br/>b</p>')).toEqual([{ tag: 'p', attrs: {}, children: ['a', { tag: 'br', attrs: {}, children: [] }, 'b'] }]);
		expect(decodeEntities('&#65;&#x42;&quot;&unknown;')).toBe('AB"&unknown;');
	});

	it('writes a plain text as one paragraph per line', () => {
		expect(textToAdf('a\n\nb')).toEqual(doc(p(text('a')), { type: 'paragraph' }, p(text('b'))));
	});
});

describe('the round trip', () => {
	const samples = [
		'<p>Hello <strong>world</strong></p>',
		'<h3>Steps</h3><ol><li><p>one</p></li><li><p>two <a href="https://e.io" rel="noopener noreferrer">link</a></p></li></ol>',
		'<blockquote><p>q</p></blockquote><pre><code>x &lt; y</code></pre><hr><p><em><s>gone</s></em></p>',
		'<table><tbody><tr><th><p>a</p></th></tr><tr><td><p>b</p></td></tr></tbody></table>',
		'<p>a<br>b</p><ul><li><p>x</p><ul><li><p>y</p></li></ul></li></ul>'
	];

	it.each(samples)('reads the task store’s own HTML back as it was: %s', (html) => {
		expect(canonicalHtml(html)).toBe(html);
	});

	it('is stable: a description read back once reads back the same every time after', () => {
		const messy = '<div><b>Bold</b> <i>it</i><span>plain</span></div><p>x<script>y</script></p><ul><li>a</li></ul>';
		const once = canonicalHtml(messy);
		expect(once).toBe('<p><strong>Bold</strong> <em>it</em>plain</p><p>x</p><ul><li><p>a</p></li></ul>');
		expect(canonicalHtml(once)).toBe(once);
	});

	it('round-trips what Jira sends: html(adf(html(doc))) is html(doc)', () => {
		const fromJira = doc(
			{ type: 'heading', attrs: { level: 4 }, content: [text('H')] },
			p(text('a', 'strong', 'em'), text('b', { type: 'link', attrs: { href: 'https://x.io' } })),
			{ type: 'panel', content: [p(text('note'))] },
			{ type: 'taskList', content: [{ type: 'taskItem', attrs: { state: 'TODO' }, content: [text('t')] }] }
		);
		const html = adfToHtml(fromJira);
		expect(adfToHtml(htmlToAdf(html))).toBe(html);
	});
});
