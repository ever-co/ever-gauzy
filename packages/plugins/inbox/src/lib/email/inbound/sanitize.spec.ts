import { sanitizeEmailHtml, snippetOf, textFromHtml } from './sanitize';

describe('inbound email HTML', () => {
	it('drops scripts, handlers, forms, frames, styles sheets and javascript: links', () => {
		const html = sanitizeEmailHtml(
			'<style>body{display:none}</style><p onclick="x()">Hi<script>alert(1)</script></p>' +
				'<form action="https://evil.test"><input name="password"></form><iframe src="https://evil.test"></iframe>' +
				'<a href="javascript:alert(1)">bad</a><svg><script>1</script></svg><object data="x"></object>'
		);
		expect(html).not.toMatch(/script|onclick|<form|<input|<iframe|<svg|<object|<style|javascript:|display:none/i);
		expect(html).toContain('<p>Hi</p>');
	});

	it('opens links in a new context without a referrer', () => {
		expect(sanitizeEmailHtml('<a href="https://acme.test/x">x</a>')).toBe(
			'<a href="https://acme.test/x" target="_blank" rel="noopener noreferrer nofollow">x</a>'
		);
	});

	it('blocks remote images and keeps inline (cid:) ones', () => {
		const html = sanitizeEmailHtml(
			'<img src="https://tracker.test/p.gif" alt="t"><img src="cid:logo@acme" alt="logo">'
		);
		expect(html).toContain('data-remote-src="https://tracker.test/p.gif"');
		expect(html).not.toMatch(/\ssrc="https:/);
		expect(html).toContain('src="cid:logo@acme"');
	});

	it('keeps plain presentation styles and drops dangerous ones', () => {
		const html = sanitizeEmailHtml(
			'<p style="color: #333; position: fixed; background-image: url(https://x.test/a.png); font-weight: bold">x</p>'
		);
		expect(html).toContain('color:#333');
		expect(html).toContain('font-weight:bold');
		expect(html).not.toMatch(/position|url\(/);
	});

	it('derives text from HTML and a one-line snippet', () => {
		expect(textFromHtml('<p>Hello&nbsp;<b>Ada</b></p><p>Line &amp; two&#33;</p><style>x{}</style>')).toBe(
			'Hello Ada\nLine & two!'
		);
		expect(snippetOf('  a\n\n b  ')).toBe('a b');
		expect(snippetOf('x'.repeat(500))).toHaveLength(200);
	});
});
