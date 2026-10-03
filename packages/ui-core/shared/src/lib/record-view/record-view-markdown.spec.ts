import { markdownToHtml, richTextToHtml } from './record-view-markdown';

describe('record view markdown', () => {
	describe('drops what is never displayed', () => {
		it('removes HTML comments and <script> / <style> blocks from prose', () => {
			expect(markdownToHtml('Before <!-- hidden --> after')).toBe('<p>Before  after</p>');
			expect(markdownToHtml('Text <script>alert(1)</script> and <STYLE>p{}</style > end')).toBe(
				'<p>Text  and  end</p>'
			);
		});

		it('leaves an unclosed comment as escaped text and never emits an unclosed <script>', () => {
			expect(markdownToHtml('Open <!-- never closed')).toBe('<p>Open &lt;!-- never closed</p>');
			expect(markdownToHtml('Open <script> never closed')).toBe('<p>Open  never closed</p>');
		});

		it('does not let a comment glue a <script> together', () => {
			expect(markdownToHtml('<scr<!-- x -->ipt>alert(1)</script>')).not.toContain('<script');
		});

		it('keeps comments and scripts inside fenced code, escaped', () => {
			expect(markdownToHtml('```\n<!-- kept -->\n<script>x</script>\n```')).toBe(
				'<div class="md-code"><pre><code>&lt;!-- kept --&gt;\n&lt;script&gt;x&lt;/script&gt;</code></pre></div>'
			);
		});
	});

	it('rebuilds inline tags without their attributes, keeping only vetted URLs', () => {
		expect(
			markdownToHtml(
				'A <b onclick="x()">bold</b> <a href="https://e.com" onclick="y">link</a> <a href="javascript:alert(1)">bad</a>'
			)
		).toBe(
			'<p>A <b>bold</b> <a href="https://e.com" target="_blank" rel="noopener noreferrer">link</a> <a>bad</a></p>'
		);
		expect(markdownToHtml(`<img alt='a>b' src="https://e.com/i.png">`)).toBe(
			'<p><img src="https://e.com/i.png" alt="a&gt;b" /></p>'
		);
	});

	it('unwraps markdown the rich-text editor wrapped in <p> / <br>, and leaves real rich text alone', () => {
		expect(richTextToHtml('<p># Title</p><p>- one<br>- two</p>')).toBe(
			'<h1>Title</h1><ul><li>one</li><li>two</li></ul>'
		);
		expect(richTextToHtml('<!-- c --><p>Hello <strong>world</strong></p>')).toBe(
			'<!-- c --><p>Hello <strong>world</strong></p>'
		);
		expect(richTextToHtml('<p>plain words only</p>')).toBe('<p>plain words only</p>');
	});

	/*
	 * Each input made the old global regexes scan the rest of the text again from every opener that never
	 * closes: `'<a '` repeated 20,000 times took about 9 s in `richTextToHtml` and 4 s in
	 * `markdownToHtml`. The scanners are linear; the bound is generous so a busy runner cannot flake it.
	 */
	it.each([
		['unclosed tags', '<a '.repeat(40_000)],
		['unclosed tags with quotes', '<a "'.repeat(40_000) + '>'],
		['unclosed comments', '<!--'.repeat(40_000)],
		['unclosed scripts', '<script '.repeat(40_000)],
		['unterminated closing tags', '<script>' + '</script '.repeat(40_000)],
		['editor-wrapped unclosed tags', '<p>' + '<a '.repeat(40_000)]
	])('renders %s in linear time', (_label, input) => {
		const started = Date.now();
		richTextToHtml(input);
		markdownToHtml(input);
		expect(Date.now() - started).toBeLessThan(3000);
	});
});
