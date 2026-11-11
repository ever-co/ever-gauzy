// cspell:ignore Lineone
import { cleanText, cleanUrl, decodeEntities, decodePage, headEnded, parsePreviewHead, scanHead } from './link-preview-parser';

const PAGE = 'https://www.example.com/articles/one?ref=chat';
const char = (code: number) => String.fromCodePoint(code);

describe('parsePreviewHead', () => {
	it('reads the Open Graph fields first, then the Twitter card, then the plain head', () => {
		const html = `<!doctype html><html><head>
			<title>Plain title</title>
			<meta name="description" content="Plain description">
			<meta name="twitter:title" content="Card title">
			<meta property="og:title" content="Graph title">
			<meta property="og:description" content="Graph description">
			<meta property="og:site_name" content="Example News">
			<meta property="og:image" content="/img/cover.jpg">
			<meta property="og:image:alt" content="A cover">
			<meta property="og:image:width" content="1200">
			<meta property="og:image:height" content="630">
			<link rel="shortcut icon" href="/favicon.ico">
		</head><body></body></html>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({
			title: 'Graph title',
			description: 'Graph description',
			siteName: 'Example News',
			image: 'https://www.example.com/img/cover.jpg',
			imageAlt: 'A cover',
			imageWidth: 1200,
			imageHeight: 630,
			icon: 'https://www.example.com/favicon.ico'
		});
	});

	it('falls back to the Twitter card and to the title tag and description', () => {
		expect(
			parsePreviewHead(
				`<head><meta name="twitter:title" content="Card"><meta name="twitter:image" content="https://cdn.example.com/c.png"><meta name="description" content="Desc"></head>`,
				PAGE
			)
		).toEqual({ title: 'Card', description: 'Desc', image: 'https://cdn.example.com/c.png' });
		expect(parsePreviewHead('<html><head><title> Just  a\ttitle </title></head></html>', PAGE)).toEqual({ title: 'Just a title' });
	});

	it('reads attributes in any order and quoting, and the first of a repeated tag', () => {
		const html = `<head><meta content='First' property=og:title><meta property="og:title" content="Second"><META PROPERTY="OG:DESCRIPTION" CONTENT=Unquoted></head>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({ title: 'First', description: 'Unquoted' });
	});

	it('parses only the head: tags after it, and text in scripts, styles and comments, are ignored', () => {
		const html = `<head>
			<!-- <meta property="og:title" content="Commented"> </head> -->
			<script>document.write('<meta property="og:description" content="Scripted">')</script>
			<style>.x{content:'<meta property="og:image" content="https://evil.example.com/x.png">'}</style>
			<title>Real</title>
		</head><body><meta property="og:description" content="In the body"></body>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({ title: 'Real' });
		// A page with no head tag at all ends its head where its body starts.
		expect(parsePreviewHead('<title>Headless</title><body><meta name="description" content="late">', PAGE)).toEqual({ title: 'Headless' });
	});

	it('reads a tag whole when a quoted value holds a ">"', () => {
		const html = `<head><meta property="og:title" content="Forecast > sunny"><meta name='description' content='a > b, c'><link rel="icon" title="x > y" href="/i.png"></head>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({ title: 'Forecast > sunny', description: 'a > b, c', icon: 'https://www.example.com/i.png' });
	});

	it('reads comments and scripts in document order: a "<!--" in a script, a "</script>" in a comment', () => {
		const html = `<head><script>var s = "<!--";</script><title>After the script</title><!-- </script> --><meta name="description" content="Kept"></head>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({ title: 'After the script', description: 'Kept' });
	});

	it('has no preview for a page that says nothing usable', () => {
		expect(parsePreviewHead('<html><head><link rel="icon" href="/i.png"></head></html>', PAGE)).toBeNull();
		expect(parsePreviewHead('', PAGE)).toBeNull();
		expect(parsePreviewHead('{"json": true}', PAGE)).toBeNull();
	});

	it('keeps sanitized plain text only: markup, entities, control and bidirectional characters', () => {
		const html = `<head>
			<meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt;Tom &amp; Jerry ${char(0x202e)}gnp.exe${char(0x202c)}">
			<meta property="og:description" content="Line${char(7)}one&#10;&#x2028;two &quot;quoted&quot; &copy; &#128512;">
		</head>`;
		const data = parsePreviewHead(html, PAGE);
		expect(data?.title).toBe('alert(1) Tom & Jerry gnp.exe');
		expect(data?.description).toBe(`Lineone two "quoted" ${char(0xa9)} ${char(0x1f600)}`);
	});

	it('cuts long fields to their limits on a character boundary', () => {
		const emoji = char(0x1f600);
		const data = parsePreviewHead(`<head><meta property="og:title" content="${emoji.repeat(400)}"><meta name="description" content="${'d'.repeat(5000)}"></head>`, PAGE);
		expect(Array.from(data?.title ?? '')).toHaveLength(300);
		expect(data?.title?.endsWith(char(0x2026))).toBe(true);
		expect(Array.from(data?.title ?? '').slice(0, -1).every((point) => point === emoji)).toBe(true);
		expect(data?.description).toHaveLength(1000);
	});

	it('keeps only https image and icon URLs on public hosts, resolved against the page', () => {
		const head = (image: string) => `<head><title>T</title><meta property="og:image" content="${image}"></head>`;
		expect(parsePreviewHead(head('//cdn.example.com/a.png'), PAGE)?.image).toBe('https://cdn.example.com/a.png');
		expect(parsePreviewHead(head('https://cdn.example.com/a b.png'), PAGE)?.image).toBe('https://cdn.example.com/a%20b.png');
		for (const refused of [
			'http://cdn.example.com/a.png',
			'javascript:alert(1)',
			'data:image/png;base64,AAAA',
			'https://user:pass@cdn.example.com/a.png',
			'https://192.168.1.1/router.png',
			'https://[::1]/a.png',
			'https://localhost/a.png',
			'https://printer.local/a.png',
			`https://cdn.example.com/${'a'.repeat(2100)}.png`
		]) {
			expect(parsePreviewHead(head(refused), PAGE)).toEqual({ title: 'T' });
		}
		// An http page's relative image is an http image: not kept.
		expect(parsePreviewHead(head('/a.png'), 'http://www.example.com/')).toEqual({ title: 'T' });
	});

	it('takes the touch icon when there is no icon, and ignores sizes it cannot use', () => {
		const html = `<head><title>T</title><link rel="apple-touch-icon" href="/touch.png"><meta property="og:image" content="/a.png"><meta property="og:image:width" content="-5"><meta property="og:image:height" content="99999"></head>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({
			title: 'T',
			image: 'https://www.example.com/a.png',
			icon: 'https://www.example.com/touch.png'
		});
	});
});

describe('headEnded', () => {
	it('finds a real end of the head, not one written in a script, a style, a comment or the title', () => {
		expect(headEnded('<html><head><title>T</title></head>')).toBe(true);
		expect(headEnded('<html><head><title>T</title><body>')).toBe(true);
		expect(headEnded('<head><script>document.write("</head><body>")</script>')).toBe(false);
		expect(headEnded('<head><style>/* </head> */</style><!-- <body> -->')).toBe(false);
		expect(headEnded('<head><title>Why </head> matters</title>')).toBe(false);
		// Read only so far: a script not closed yet holds everything after it.
		expect(headEnded('<head><script>var a = "</head>')).toBe(false);
		expect(headEnded('<head><script>var a = 1;</script></head>')).toBe(true);
		// Nor one inside a quoted attribute value.
		expect(headEnded('<head><meta name="x" content="</head><body> here">')).toBe(false);
		expect(headEnded("<head><link title='<body>' href='/a'></head>")).toBe(true);
	});

	it('keeps its place in a page with letters whose lower case is longer', () => {
		// A capital dotted I lower-cases to two code units: offsets read from a lower-cased copy would shift.
		const dotted = String.fromCodePoint(0x130);
		const html = `<head><title>${dotted.repeat(4)}</title><meta property="og:description" content="After the title"></head>`;
		expect(parsePreviewHead(html, PAGE)).toEqual({ title: dotted.repeat(4), description: 'After the title' });
		expect(headEnded(`<head><meta name="${dotted}" content="x"></head>`)).toBe(true);
	});

	it('ends a raw-text element only at its own closing tag, not one with a longer name', () => {
		const html = '<head><script>const s = "</scripture>";</script><title>Real</title></head>';
		expect(parsePreviewHead(html, PAGE)).toEqual({ title: 'Real' });
		expect(headEnded('<head><script>var a = "</scripts></head>";')).toBe(false);
		expect(headEnded('<head><script>var a = 1;</SCRIPT ></head>')).toBe(true);
	});

	it('reads any page in time linear in its length: no input makes it backtrack', () => {
		const half = 256 * 1024;
		for (const unit of ['<script ', '<meta content="', "<link title='", '<', '<!--', '<a', '</', '<title>', '<meta a="b" ']) {
			const page = unit.repeat(Math.ceil(half / unit.length));
			const started = Date.now();
			scanHead(page);
			headEnded(page);
			parsePreviewHead(page, PAGE);
			expect(Date.now() - started).toBeLessThan(1000);
		}
	});

	it('cleans a huge value in time linear in its length', () => {
		const started = Date.now();
		expect(cleanText('<'.repeat(512 * 1024), 1000)).toBeUndefined();
		cleanText(`${'<a'.repeat(100000)}x`, 300);
		expect(Date.now() - started).toBeLessThan(1000);
	});
});

describe('the text and URL cleaners', () => {
	it('decodes numeric and named character references, refusing invalid code points', () => {
		expect(decodeEntities('&amp;&lt;&gt;&quot;&apos;&#39;&#x41;&#66;')).toBe(`&<>"''AB`);
		expect(decodeEntities('&#0;&#xD800;&#x110000;')).toBe(char(0xfffd).repeat(3));
		expect(decodeEntities('&unknown; &constructor; &amp')).toBe('&unknown; &constructor; &');
	});

	it('drops what is empty once cleaned', () => {
		expect(cleanText('   ', 10)).toBeUndefined();
		expect(cleanText('<b></b>', 10)).toBeUndefined();
		expect(cleanText(undefined, 10)).toBeUndefined();
		expect(cleanUrl('', PAGE)).toBeUndefined();
		expect(cleanUrl('http://[', PAGE)).toBeUndefined();
	});
});

describe('decodePage', () => {
	it('reads the charset the answer named', () => {
		expect(decodePage(Buffer.from([0x43, 0x61, 0x66, 0xe9]), 'iso-8859-1')).toBe(`Caf${char(0xe9)}`);
	});

	it('reads the charset a meta tag names when the answer named none', () => {
		const body = Buffer.concat([Buffer.from('<head><meta charset="windows-1252"><title>'), Buffer.from([0x93, 0x68, 0x69, 0x94]), Buffer.from('</title>')]);
		expect(decodePage(body, null)).toContain(`${char(0x201c)}hi${char(0x201d)}`);
	});

	it('reads UTF-8 otherwise, and for a charset it does not know', () => {
		const text = `na${char(0xef)}ve ${char(0x1f600)}`;
		expect(decodePage(Buffer.from(text, 'utf8'), null)).toBe(text);
		expect(decodePage(Buffer.from(text, 'utf8'), 'x-no-such-charset')).toBe(text);
	});
});
