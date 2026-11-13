// cspell:ignore gzimport
import { DocumentImportLayoutEnum } from '@gauzy/contracts';
import { IDocNode } from '../services/document-markdown';
import {
	convertImportedPage,
	emojiIconOf,
	exportDateOf,
	htmlToMarkdown,
	IImportResolvedTarget,
	parseWikiTarget,
	rawFileUrlOf,
	readFrontMatter,
	readHtmlPage,
	readMarkdownPage,
	rewriteWikiSyntax
} from './import-content';
import { buildImportPlan, IImportLinkTarget, ImportLinkIndex } from './import-plan';

const VAULT = DocumentImportLayoutEnum.MARKDOWN_VAULT;
const EXPORT = DocumentImportLayoutEnum.HTML_EXPORT;

/** A vault of a few pages and files, with the document each would get. */
function fixture() {
	const plan = buildImportPlan(
		['V/Home.md', 'V/Release checklist.md', 'V/Onboarding.md', 'V/img/diagram.png', 'V/spec.pdf', 'V/skipped.exe'],
		[],
		VAULT
	);
	const documents: Record<string, IImportResolvedTarget> = {
		'V/Release checklist.md': { documentId: 'page-release', name: 'Release checklist' },
		'V/Onboarding.md': { documentId: 'page-onboarding', name: 'Onboarding' },
		'V/img/diagram.png': { documentId: 'file-diagram', name: 'diagram.png', mimeType: 'image/png', size: 70 },
		'V/spec.pdf': { documentId: 'file-spec', name: 'spec.pdf', mimeType: 'application/pdf', size: 1234 }
	};
	return { links: new ImportLinkIndex(plan), resolve: (target: IImportLinkTarget) => documents[target.key] ?? null };
}

function convert(markdown: string, title = 'Home', fromPath = 'V/Home.md') {
	const { links, resolve } = fixture();
	return convertImportedPage({ source: { meta: {}, markdown }, title, fromPath, links, resolve });
}

/** Every node of a type, depth first. */
function all(node: IDocNode, type: string): IDocNode[] {
	const found = node.type === type ? [node] : [];
	return found.concat(...(node.content ?? []).map((child) => all(child, type)));
}

describe('front matter and metadata', () => {
	it('reads simple front matter and leaves the body', () => {
		const { fields, body } = readFrontMatter('---\ntitle: "Launch plan"\nicon: 🚀\ntags:\n  - a\ncreated: 2024-03-01\n---\n# Body\n');
		expect(fields).toEqual({ title: 'Launch plan', icon: '🚀', created: '2024-03-01' });
		expect(body).toBe('# Body\n');
	});

	it('keeps a page without front matter as it is', () => {
		expect(readFrontMatter('text --- more').body).toBe('text --- more');
	});

	it('reads the title, emoji and created date of a Markdown page', () => {
		const page = readMarkdownPage('---\ntitle: Launch\nemoji: 🎯\ncreated_at: 2024-03-01T10:00:00Z\n---\nHello', VAULT);
		expect(page.meta).toEqual({ title: 'Launch', icon: '🎯', createdAt: new Date('2024-03-01T10:00:00Z') });
		expect(page.markdown).toBe('Hello');
	});

	it('reads the H1 title and the property lines of an HTML export Markdown page, and drops the properties', () => {
		const page = readMarkdownPage('# Roadmap / 2024\n\nCreated: March 3, 2024 10:00 AM\nTags: plan\n\nFirst paragraph', EXPORT);
		expect(page.meta.title).toBe('Roadmap / 2024');
		expect(page.meta.createdAt?.getFullYear()).toBe(2024);
		expect(page.markdown).toBe('# Roadmap / 2024\n\nFirst paragraph');
	});

	it('keeps a first paragraph of `Key: value` lines that are not the export properties', () => {
		const page = readMarkdownPage('# Plan\n\nGoal: ship v2\nOwner: Ana\n\nDetails', EXPORT);
		expect(page.meta.title).toBe('Plan');
		expect(page.markdown).toBe('# Plan\n\nGoal: ship v2\nOwner: Ana\n\nDetails');
	});

	it('accepts only an emoji as an icon, and only a sensible date', () => {
		expect(emojiIconOf('🚀')).toBe('🚀');
		expect(emojiIconOf('👩🏽‍💻')).toBe('👩🏽‍💻');
		expect(emojiIconOf('🇫🇷')).toBe('🇫🇷');
		expect(emojiIconOf('rocket')).toBeUndefined();
		expect(emojiIconOf('<img src=x>')).toBeUndefined();
		expect(exportDateOf('@March 3, 2024')?.getFullYear()).toBe(2024);
		expect(exportDateOf('not a date')).toBeUndefined();
		expect(exportDateOf('3024-01-01')).toBeUndefined();
	});
});

describe('HTML pages', () => {
	const html = `<!DOCTYPE html><html><head><title>Roadmap</title><style>body{}</style></head><body><article class="page sans">
<header><div class="page-header-icon undefined"><span class="icon">🗺️</span></div><h1 class="page-title">Roadmap &amp; goals</h1>
<table class="properties"><tbody><tr class="property-row property-row-created_time"><th>Created</th><td><time>@March 3, 2024 10:00 AM</time></td></tr></tbody></table></header>
<div class="page-body"><h2>Goals</h2><p>Ship <strong>fast</strong> and <a href="Q1%20${'a'.repeat(32)}.html">see Q1</a>.</p>
<script>alert(1)</script><p onclick="steal()">Click</p><a href="javascript:alert(1)">bad</a>
<img src="data:image/png;base64,AAAA"><img src="Roadmap/chart.png" alt="Chart">
<ul class="to-do-list"><li><div class="checkbox checkbox-on"></div><span>Done task</span></li><li><div class="checkbox checkbox-off"></div><span>Open task</span></li></ul>
<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></div></article></body></html>`;

	it('reads the export header: title, emoji icon, created date', () => {
		const page = readHtmlPage(html);
		expect(page.meta.title).toBe('Roadmap & goals');
		expect(page.meta.icon).toBe('🗺️');
		expect(page.meta.createdAt?.getFullYear()).toBe(2024);
	});

	it('reads the created date from the export properties only, never from a table of the body', () => {
		const withoutProperty = `<html><head><title>Notes</title></head><body><article><header><h1 class="page-title">Notes</h1></header>
<div class="page-body"><table><tr><th>Created</th><td>2024-01-01</td></tr></table></div></article></body></html>`;
		expect(readHtmlPage(withoutProperty).meta.createdAt).toBeUndefined();
	});

	it('turns the body into Markdown without the header, scripts, handlers, javascript: links or data: images', () => {
		const { markdown } = readHtmlPage(html);
		expect(markdown).toContain('## Goals');
		expect(markdown).toContain('**fast**');
		expect(markdown).toContain(`[see Q1](Q1%20${'a'.repeat(32)}.html)`);
		expect(markdown).toContain('![Chart](Roadmap/chart.png)');
		expect(markdown).toMatch(/-\s+\[x\] +Done task/);
		expect(markdown).toMatch(/-\s+\[ \] +Open task/);
		expect(markdown).toContain('| A | B |');
		expect(markdown).not.toMatch(/Roadmap & goals|alert|steal|javascript|data:|<script/);
		expect(markdown).toContain('Click');
		expect(markdown).toContain('bad');
	});

	it('keeps only checkbox inputs', () => {
		expect(htmlToMarkdown('<ul><li><input type="text" value="x">Item</li></ul>')).toMatch(/^-\s+Item$/);
	});
});

describe('wiki syntax', () => {
	it('parses target, heading and alias, with a table-escaped bar', () => {
		expect(parseWikiTarget('Page#Steps|Start here')).toEqual({ target: 'Page', heading: 'Steps', alias: 'Start here' });
		expect(parseWikiTarget('Page\\|Alias')).toEqual({ target: 'Page', alias: 'Alias' });
		expect(parseWikiTarget('Page#^block-1')).toEqual({ target: 'Page', heading: 'block-1' });
	});

	it('rewrites links and embeds outside code only', () => {
		const out = rewriteWikiSyntax('See [[Release checklist]] and [[Onboarding|start_here]], `[[not a link]]`\n```\n[[in fence]]\n```\n![[diagram.png|300]]');
		expect(out).toContain('[Release checklist](gzimport-wiki:Release%20checklist)');
		expect(out).toContain('[start\\_here](gzimport-wiki:Onboarding)');
		expect(out).toContain('`[[not a link]]`');
		expect(out).toContain('[[in fence]]');
		expect(out).toContain('![diagram.png](gzimport-embed:diagram.png)');
	});
});

describe('convertImportedPage', () => {
	it('turns wiki links into page mentions labelled with their text', () => {
		const result = convert('Read [[Release checklist]] and [[Onboarding|start here]].');
		const mentions = all(result.contentJson, 'documentMention');
		expect(mentions.map((node) => node.attrs)).toEqual([
			{ id: 'page-release', label: 'Release checklist', mentionSuggestionChar: '+' },
			{ id: 'page-onboarding', label: 'start here', mentionSuggestionChar: '+' }
		]);
		expect(result.mentionedDocumentIds).toEqual(['page-release', 'page-onboarding']);
		expect(result.unresolvedLinks).toBe(0);
		expect(result.schemaFallback).toBe(false);
	});

	it('resolves relative Markdown links to pages, and keeps external links', () => {
		const result = convert('[the list](Release%20checklist.md) · [site](https://example.com) · [mail](mailto:a@b.c)');
		expect(all(result.contentJson, 'documentMention')[0].attrs).toMatchObject({ id: 'page-release', label: 'the list' });
		const hrefs = all(result.contentJson, 'text').flatMap((node) => (node.marks ?? []).map((mark) => mark.attrs?.['href']));
		expect(hrefs).toEqual(['https://example.com', 'mailto:a@b.c']);
	});

	it('keeps the text of a link to nothing, and counts it', () => {
		const result = convert('[[Nowhere]] and [gone](missing.md) and [js](javascript:alert(1))');
		expect(all(result.contentJson, 'documentMention')).toHaveLength(0);
		expect(all(result.contentJson, 'text').every((node) => !node.marks?.length)).toBe(true);
		expect(all(result.contentJson, 'text').map((node) => node.text).join('')).toContain('Nowhere');
		expect(result.unresolvedLinks).toBe(2);
	});

	it('shows an embedded image as the stored file, and a PDF embed alone in its paragraph as a card', () => {
		const result = convert('![[diagram.png]]\n\n![[spec.pdf]]\n\nInline ![[spec.pdf]] here');
		expect(all(result.contentJson, 'image')[0].attrs).toEqual({ src: rawFileUrlOf('file-diagram'), documentId: 'file-diagram', alt: 'diagram.png' });
		// On a line of its own, a block, as the editor holds an image; and so is the card.
		expect(result.contentJson.content?.slice(0, 2).map((node) => node.type)).toEqual(['image', 'fileAttachment']);
		expect(all(result.contentJson, 'fileAttachment')[0].attrs).toEqual({ documentId: 'file-spec', name: 'spec.pdf', size: 1234, mimeType: 'application/pdf' });
		const inline = result.contentJson.content?.[2];
		expect(inline?.type).toBe('paragraph');
		expect(all(inline as IDocNode, 'text').some((node) => node.marks?.[0]?.attrs?.['href'] === rawFileUrlOf('file-spec'))).toBe(true);
	});

	it('resolves a relative image, keeps an external one, and replaces a skipped or data: image by its text', () => {
		const result = convert('![a](img/diagram.png) ![b](https://cdn.example.com/x.png) ![c](skipped.exe) ![d](data:image/png;base64,AAAA)');
		const images = all(result.contentJson, 'image');
		expect(images.map((node) => node.attrs?.['src'])).toEqual([rawFileUrlOf('file-diagram'), 'https://cdn.example.com/x.png']);
		const text = all(result.contentJson, 'text').map((node) => node.text).join('');
		expect(text).toContain('c');
		expect(text).toContain('d');
		expect(result.unresolvedLinks).toBe(1);
	});

	it('links a wiki link to an attachment to the stored file', () => {
		const result = convert('[[spec.pdf]]');
		const marks = all(result.contentJson, 'text')[0].marks ?? [];
		expect(marks[0]).toMatchObject({ type: 'link', attrs: { href: rawFileUrlOf('file-spec') } });
	});

	it('drops a leading heading equal to the title, and keeps any other', () => {
		expect(convert('# Home\n\nBody').contentJson.content?.[0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] });
		expect(convert('# Other\n\nBody').contentJson.content?.[0].type).toBe('heading');
	});

	it('converts the structures of the stored subset, links inside lists, quotes, tables and headings included', () => {
		const result = convert('## See [[Onboarding]]\n\n- [x] [[Release checklist]]\n- [ ] task\n\n> quote [[Onboarding]]\n\n| A | B |\n|---|---|\n| [[Onboarding]] | 2 |\n\n```js\n[[kept]]\n```');
		expect(all(result.contentJson, 'documentMention')).toHaveLength(4);
		expect(all(result.contentJson, 'taskItem').map((node) => node.attrs?.['checked'])).toEqual([true, false]);
		expect(all(result.contentJson, 'codeBlock')[0].content?.[0].text).toBe('[[kept]]');
	});

	it('gives an empty page one empty paragraph', () => {
		expect(convert('').contentJson).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
	});

	it('keeps raw HTML in Markdown as text, never as markup', () => {
		const result = convert('<script>alert(1)</script>\n\nText <b onclick=x>bold</b>');
		const text = all(result.contentJson, 'text').map((node) => node.text).join(' ');
		expect(text).toContain('<script>alert(1)</script>');
		expect(all(result.contentJson, 'text').every((node) => !node.marks?.some((mark) => mark.type === 'bold'))).toBe(true);
	});
});
