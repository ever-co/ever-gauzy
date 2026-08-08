import { getSchema } from '@tiptap/core';
import { generateHTML, generateJSON } from '@tiptap/html';
import { createMinimalPreset } from './presets/minimal.preset';
import { createStandardPreset } from './presets/standard.preset';
import { createEmailPreset } from './presets/email.preset';
import { createEditorExtensions } from './presets';
import { normalizeLegacyHtml } from './legacy-html.util';

/**
 * Tier-1 preset-factory + legacy round-trip tests (05-editor-spec.md §3.6 / §14).
 * Schema membership is asserted per preset, and a representative legacy CKEditor
 * snippet is round-tripped through the `standard` schema (load → serialize) to
 * prove no content-bearing construct is dropped.
 */
describe('rich-text-editor presets', () => {
	describe('createEditorExtensions (async factory)', () => {
		it('resolves each preset with its own extension set + toolbar', async () => {
			const minimal = await createEditorExtensions('minimal');
			const standard = await createEditorExtensions('standard');
			const email = await createEditorExtensions('email');

			expect(minimal.preset).toBe('minimal');
			expect(standard.preset).toBe('standard');
			expect(email.preset).toBe('email');
			expect(standard.toolbar).toContain('align');
			expect(minimal.toolbar).not.toContain('align');
			expect(email.toolbarOptions.marks).not.toContain('strike');
		});
	});

	describe('schema membership', () => {
		it('minimal registers marks/lists/link/blockquote/code but no headings, tables or images', () => {
			const schema = getSchema(createMinimalPreset().extensions);
			// present
			expect(schema.marks['bold']).toBeDefined();
			expect(schema.marks['italic']).toBeDefined();
			expect(schema.marks['underline']).toBeDefined();
			expect(schema.marks['strike']).toBeDefined();
			expect(schema.marks['code']).toBeDefined();
			expect(schema.marks['link']).toBeDefined();
			expect(schema.nodes['bulletList']).toBeDefined();
			expect(schema.nodes['orderedList']).toBeDefined();
			expect(schema.nodes['blockquote']).toBeDefined();
			// absent
			expect(schema.nodes['heading']).toBeUndefined();
			expect(schema.nodes['horizontalRule']).toBeUndefined();
			expect(schema.nodes['table']).toBeUndefined();
			expect(schema.nodes['image']).toBeUndefined();
			expect(schema.nodes['taskList']).toBeUndefined();
			expect(schema.marks['highlight']).toBeUndefined();
		});

		it('standard registers the full legacy-coverage set', () => {
			const schema = getSchema(createStandardPreset().extensions);
			expect(schema.nodes['heading']).toBeDefined();
			expect(schema.nodes['horizontalRule']).toBeDefined();
			expect(schema.nodes['table']).toBeDefined();
			expect(schema.nodes['tableRow']).toBeDefined();
			expect(schema.nodes['tableHeader']).toBeDefined();
			expect(schema.nodes['tableCell']).toBeDefined();
			expect(schema.nodes['taskList']).toBeDefined();
			expect(schema.nodes['taskItem']).toBeDefined();
			expect(schema.nodes['image']).toBeDefined();
			expect(schema.marks['highlight']).toBeDefined();
			expect(schema.marks['subscript']).toBeDefined();
			expect(schema.marks['superscript']).toBeDefined();
			expect(schema.marks['textStyle']).toBeDefined();
		});

		it('email registers an email-safe schema: no code, no tables, no highlight', () => {
			const schema = getSchema(createEmailPreset().extensions);
			expect(schema.nodes['heading']).toBeDefined();
			expect(schema.nodes['image']).toBeDefined();
			expect(schema.marks['textStyle']).toBeDefined();
			expect(schema.marks['subscript']).toBeDefined();
			// absent
			expect(schema.marks['code']).toBeUndefined();
			expect(schema.nodes['codeBlock']).toBeUndefined();
			expect(schema.nodes['table']).toBeUndefined();
			expect(schema.marks['highlight']).toBeUndefined();
			expect(schema.nodes['taskList']).toBeUndefined();
		});
	});

	describe('legacy CKEditor HTML round-trip (standard preset, §3.6 contract)', () => {
		const extensions = createStandardPreset().extensions;

		it('round-trips a representative legacy snippet losslessly', () => {
			const legacy = [
				'<h1 style="text-align: center;">Project overview</h1>',
				'<p><strong>Bold</strong> and <u>underlined</u> and <s>struck</s> text with <sub>sub</sub>/<sup>sup</sup>.</p>',
				'<p><span style="color: #e74c3c;">colored</span> <span style="font-family: Georgia, serif;">serif</span></p>',
				'<ul><li>one</li><li>two</li></ul>',
				'<ol start="3"><li>three</li></ol>',
				'<blockquote><p>quoted</p></blockquote>',
				'<p><a href="https://ever.co" target="_blank" rel="noopener noreferrer nofollow">link</a></p>',
				'<img src="https://ever.co/logo.png" alt="logo" width="120" height="40">',
				'<table><tbody><tr><th>Head</th><th>er</th></tr><tr><td colspan="2">cell</td></tr></tbody></table>',
				'<hr>'
			].join('');

			const json = generateJSON(normalizeLegacyHtml(legacy), extensions);
			const html = generateHTML(json, extensions);

			expect(html).toContain('<h1');
			expect(html).toContain('text-align: center');
			expect(html).toContain('<strong>Bold</strong>');
			expect(html).toContain('<u>underlined</u>');
			expect(html).toContain('<s>struck</s>');
			expect(html).toContain('<sub>sub</sub>');
			expect(html).toContain('<sup>sup</sup>');
			// The colour survives, but the DOM canonicalizes hex notation to `rgb()` when
			// the style is read back — `#e74c3c` === `rgb(231, 76, 60)`. Notation is not
			// content; the corpus suite normalizes both sides before diffing.
			expect(html).toContain('color: rgb(231, 76, 60)');
			expect(html).toContain('font-family: Georgia');
			expect(html).toContain('<ul');
			expect(html).toContain('start="3"');
			expect(html).toContain('<blockquote>');
			expect(html).toContain('href="https://ever.co"');
			expect(html).toContain('target="_blank"');
			expect(html).toContain('src="https://ever.co/logo.png"');
			expect(html).toContain('width="120"');
			expect(html).toContain('<table');
			expect(html).toContain('<th');
			expect(html).toContain('colspan="2"');
			expect(html).toContain('<hr');
		});

		it('parses legacy <font> tags after normalizeLegacyHtml rewriting', () => {
			const json = generateJSON(
				normalizeLegacyHtml('<p><font color="#ff0000" face="Verdana">legacy font</font></p>'),
				extensions
			);
			const html = generateHTML(json, extensions);
			expect(html).toContain('legacy font');
			// `#ff0000` read back through the DOM as `rgb(255, 0, 0)` — same colour.
			expect(html).toContain('color: rgb(255, 0, 0)');
			expect(html).toContain('Verdana');
		});

		it('parses the deprecated align attribute after style promotion', () => {
			const json = generateJSON(normalizeLegacyHtml('<p align="right">right</p>'), extensions);
			const html = generateHTML(json, extensions);
			expect(html).toContain('text-align: right');
		});
	});

	describe('normalizeLegacyHtml()', () => {
		it('returns an empty string for empty input', () => {
			expect(normalizeLegacyHtml('')).toBe('');
			expect(normalizeLegacyHtml(null as unknown as string)).toBe('');
		});

		it('rewrites <font color face> to a styled span', () => {
			const result = normalizeLegacyHtml('<p><font color="#00ff00" face="Arial">x</font></p>');
			expect(result).not.toContain('<font');
			expect(result).toContain('<span');
			expect(result).toContain('color: #00ff00');
			expect(result).toContain('font-family: Arial');
		});

		it('promotes the align attribute to a text-align style', () => {
			const result = normalizeLegacyHtml('<p align="center">x</p>');
			expect(result).not.toContain('align="center"');
			expect(result).toContain('text-align: center');
		});

		it('collapses &nbsp; spacer paragraphs to empty paragraphs', () => {
			const result = normalizeLegacyHtml('<p>&nbsp;</p><p>text</p>');
			expect(result).toContain('<p></p>');
			expect(result).toContain('<p>text</p>');
		});

		it('unwraps figure/figcaption into image + caption paragraph', () => {
			const result = normalizeLegacyHtml(
				'<figure><img src="https://x.test/a.png"><figcaption>caption</figcaption></figure>'
			);
			expect(result).not.toContain('<figure');
			expect(result).toContain('<img');
			expect(result).toContain('caption');
		});

		it('strips CKEditor namespace artifacts and comments', () => {
			const result = normalizeLegacyHtml(
				'<!-- note --><p class="cke_widget keep" data-cke-saved-href="x">x</p>'
			);
			expect(result).not.toContain('cke_widget');
			expect(result).not.toContain('data-cke-saved-href');
			expect(result).not.toContain('<!--');
			expect(result).toContain('class="keep"');
		});
	});
});
