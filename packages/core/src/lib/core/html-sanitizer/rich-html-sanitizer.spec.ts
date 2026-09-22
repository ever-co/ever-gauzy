import { sanitizeRichHtml } from './rich-html-sanitizer';

describe('sanitizeRichHtml', () => {
	describe('hostile markup stripping', () => {
		it('strips <script> elements', () => {
			const out = sanitizeRichHtml('<p>hello</p><script>alert(1)</script>');
			expect(out).toBe('<p>hello</p>');
		});

		it('strips <iframe> embeds', () => {
			const out = sanitizeRichHtml('<iframe src="https://evil.example"></iframe><p>ok</p>');
			expect(out).not.toContain('iframe');
			expect(out).toContain('<p>ok</p>');
		});

		it('strips form widgets (form/input/select/textarea/button)', () => {
			const out = sanitizeRichHtml(
				'<form action="https://evil.example"><input value="x" /><select><option>a</option></select><textarea>t</textarea><button>go</button></form><p>kept</p>'
			);
			expect(out).not.toContain('<form');
			expect(out).not.toContain('<input');
			expect(out).not.toContain('<select');
			expect(out).not.toContain('<textarea');
			expect(out).not.toContain('<button');
			expect(out).toContain('<p>kept</p>');
		});

		it('strips event-handler attributes (on*)', () => {
			const out = sanitizeRichHtml('<img src="https://cdn.example/a.png" onerror="alert(1)" alt="a" />');
			expect(out).not.toContain('onerror');
			expect(out).toContain('src="https://cdn.example/a.png"');
		});

		it('strips javascript: URLs', () => {
			const out = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>');
			expect(out).not.toContain('javascript');
		});

		it('strips data: image sources', () => {
			const out = sanitizeRichHtml('<img src="data:image/png;base64,AAAA" />');
			expect(out).not.toContain('data:');
		});

		it('strips svg/math vectors', () => {
			const out = sanitizeRichHtml('<svg onload="alert(1)"><circle r="1"/></svg><math><mi>x</mi></math><p>ok</p>');
			expect(out).not.toContain('<svg');
			expect(out).not.toContain('<math');
			expect(out).toContain('<p>ok</p>');
		});

		it('strips <style> elements and object/embed', () => {
			const out = sanitizeRichHtml('<style>p{display:none}</style><object data="x"></object><embed src="x"><p>ok</p>');
			expect(out).not.toContain('<style');
			expect(out).not.toContain('<object');
			expect(out).not.toContain('<embed');
		});
	});

	describe('allowlisted construct pass-through', () => {
		it('keeps structural blocks, marks, lists, quotes and code', () => {
			const html =
				'<h1>t</h1><h2>s</h2><p><strong>b</strong> <em>i</em> <u>u</u> <s>st</s> <sub>sb</sub> <sup>sp</sup> <code>c</code> <mark>m</mark></p>' +
				'<ul><li>a</li></ul><ol start="3"><li>b</li></ol><blockquote><p>q</p></blockquote><pre><code>block</code></pre><hr /><p>br<br />end</p>';
			expect(sanitizeRichHtml(html)).toBe(html);
		});

		it('keeps links with http/https/mailto/tel schemes', () => {
			expect(sanitizeRichHtml('<a href="https://x.example" rel="noopener noreferrer">x</a>')).toContain(
				'href="https://x.example"'
			);
			expect(sanitizeRichHtml('<a href="mailto:a@b.c">m</a>')).toContain('mailto:a@b.c');
			expect(sanitizeRichHtml('<a href="tel:+123">t</a>')).toContain('tel:+123');
		});

		it('keeps images with http(s) sources and size attributes', () => {
			const html = '<img src="https://cdn.example/a.png" alt="a" width="10" height="20" />';
			expect(sanitizeRichHtml(html)).toBe(html);
		});

		it('keeps tables including colspan/rowspan', () => {
			const html =
				'<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td rowspan="2">a</td><td>b</td></tr></tbody></table>';
			expect(sanitizeRichHtml(html)).toBe(html);
		});
	});

	describe('style attribute filtering', () => {
		it('keeps the safe style subset (text-align, color, background-color, font-family)', () => {
			const out = sanitizeRichHtml(
				'<p style="text-align:center"><span style="color:#ff0000;background-color:#00ff00;font-family:Arial, sans-serif">x</span></p>'
			);
			expect(out).toContain('text-align:center');
			expect(out).toContain('color:#ff0000');
			expect(out).toContain('background-color:#00ff00');
			expect(out).toContain('font-family:Arial');
		});

		it('drops non-allowlisted style properties', () => {
			const out = sanitizeRichHtml('<p style="position:fixed;top:0;text-align:right">x</p>');
			expect(out).not.toContain('position');
			expect(out).not.toContain('top');
			expect(out).toContain('text-align:right');
		});
	});

	describe('link hardening', () => {
		it('forces rel="noopener noreferrer" on every link', () => {
			const out = sanitizeRichHtml('<a href="https://x.example" target="_blank">x</a>');
			expect(out).toContain('rel="noopener noreferrer"');
		});
	});

	describe('idempotency and empty input', () => {
		it('is idempotent: sanitize(sanitize(x)) === sanitize(x)', () => {
			const inputs = [
				'<p>plain</p>',
				'<p style="text-align:center">c</p><script>x()</script>',
				'<a href="https://x.example" target="_blank">x</a>',
				'<table><tbody><tr><td colspan="2">a</td></tr></tbody></table>',
				'<img src="https://cdn.example/a.png" onerror="e()" />'
			];
			for (const input of inputs) {
				const once = sanitizeRichHtml(input);
				expect(sanitizeRichHtml(once)).toBe(once);
			}
		});

		it('returns empty/nullish values unchanged (partial-update semantics preserved)', () => {
			expect(sanitizeRichHtml('')).toBe('');
			expect(sanitizeRichHtml(null as any)).toBeNull();
			expect(sanitizeRichHtml(undefined as any)).toBeUndefined();
		});
	});
});
