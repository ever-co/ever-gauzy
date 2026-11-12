import { DocumentImportLayoutEnum, DocumentKindEnum } from '@gauzy/contracts';
import { buildImportPlan, detectImportLayout, externalIdOf, ImportLinkIndex, isIgnoredPath, stripExportId } from './import-plan';

const ID = '3f2a5c7e9b1d4f6a8c0e2b4d6f8a0c1e';
const ID2 = '1111aaaa2222bbbb3333cccc4444dddd';

/** The plan's nodes as `key → [kind, parentKey, name]`. */
function shape(paths: string[], directories: string[], layout: DocumentImportLayoutEnum) {
	const plan = buildImportPlan(paths, directories, layout);
	return Object.fromEntries(plan.nodes.map((node) => [node.key, [node.kind, node.parentKey, node.name]]));
}

describe('detectImportLayout', () => {
	it('reads a vault: Markdown pages without export ids', () => {
		expect(detectImportLayout(['Vault/Home.md', 'Vault/Notes/Idea.md', 'Vault/img/a.png'])).toBe(DocumentImportLayoutEnum.MARKDOWN_VAULT);
	});

	it('reads an HTML export from the ids of its page files or folders', () => {
		expect(detectImportLayout([`Roadmap ${ID}.md`, `Roadmap ${ID}/Q1 ${ID2}.md`])).toBe(DocumentImportLayoutEnum.HTML_EXPORT);
		expect(detectImportLayout(['Plain.md'], [`Space ${ID}`])).toBe(DocumentImportLayoutEnum.HTML_EXPORT);
	});

	it('reads HTML-only pages as an HTML export', () => {
		expect(detectImportLayout(['Home.html', 'Child/Page.html'])).toBe(DocumentImportLayoutEnum.HTML_EXPORT);
	});

	it('finds no layout without a page file (hidden files do not count)', () => {
		expect(detectImportLayout(['a.png', 'b.pdf'])).toBeNull();
		expect(detectImportLayout(['.settings/app.md', '__MACOSX/x.md'])).toBeNull();
	});
});

describe('isIgnoredPath / stripExportId', () => {
	it('ignores hidden segments, __MACOSX and desktop droppings', () => {
		expect(isIgnoredPath('Vault/.settings/workspace.json')).toBe(true);
		expect(isIgnoredPath('.DS_Store')).toBe(true);
		expect(isIgnoredPath('__MACOSX/Vault/._Home.md')).toBe(true);
		expect(isIgnoredPath('Vault/Thumbs.db')).toBe(true);
		expect(isIgnoredPath('Vault/Home.md')).toBe(false);
	});

	it('strips the trailing id, and keeps a name that is only an id', () => {
		expect(stripExportId(`Roadmap ${ID}`)).toBe('Roadmap');
		expect(stripExportId(`Q1_${ID}`)).toBe('Q1');
		expect(stripExportId(ID)).toBe(ID);
		expect(stripExportId('Release 2024')).toBe('Release 2024');
	});
});

describe('buildImportPlan', () => {
	it('turns a vault into folders, pages and attachments, in name order, parents first', () => {
		const plan = buildImportPlan(
			['Vault/Home.md', 'Vault/Notes/Page 10.md', 'Vault/Notes/Page 2.md', 'Vault/img/diagram.png', 'Vault/.settings/app.json'],
			['Vault', 'Vault/Notes', 'Vault/img', 'Vault/.settings'],
			DocumentImportLayoutEnum.MARKDOWN_VAULT
		);
		expect(plan.ignored).toEqual(['Vault/.settings/app.json']);
		expect(plan.nodes.map((node) => node.key)).toEqual([
			'Vault',
			'Vault/Home.md',
			'Vault/img',
			'Vault/Notes',
			'Vault/img/diagram.png',
			'Vault/Notes/Page 2.md',
			'Vault/Notes/Page 10.md'
		]);
		const notes = plan.nodes.find((node) => node.key === 'Vault/Notes/Page 2.md');
		expect(notes).toMatchObject({ kind: DocumentKindEnum.PAGE, parentKey: 'Vault/Notes', name: 'Page 2', index: 0, depth: 2, format: 'markdown' });
		expect(plan.nodes.find((node) => node.key === 'Vault/img/diagram.png')).toMatchObject({ kind: DocumentKindEnum.FILE, name: 'diagram.png' });
	});

	it('makes a page and a folder of the same name one page holding the folder', () => {
		expect(shape(['Roadmap.md', 'Roadmap/Q1.md', 'Roadmap/chart.png'], ['Roadmap'], DocumentImportLayoutEnum.MARKDOWN_VAULT)).toEqual({
			'Roadmap.md': [DocumentKindEnum.PAGE, null, 'Roadmap'],
			'Roadmap/Q1.md': [DocumentKindEnum.PAGE, 'Roadmap.md', 'Q1'],
			'Roadmap/chart.png': [DocumentKindEnum.FILE, 'Roadmap.md', 'chart.png']
		});
	});

	it("makes a folder's index.md (or its folder note) the folder's page", () => {
		expect(shape(['Team/index.md', 'Team/People.md', 'Ops/Ops.md', 'Ops/Runbook.md'], [], DocumentImportLayoutEnum.MARKDOWN_VAULT)).toEqual({
			'Team/index.md': [DocumentKindEnum.PAGE, null, 'Team'],
			'Team/People.md': [DocumentKindEnum.PAGE, 'Team/index.md', 'People'],
			'Ops/Ops.md': [DocumentKindEnum.PAGE, null, 'Ops'],
			'Ops/Runbook.md': [DocumentKindEnum.PAGE, 'Ops/Ops.md', 'Runbook']
		});
	});

	it('gives a page to one folder only: an index page and a folder named like it keep their trees', () => {
		expect(shape(['Team/index.md', 'Team/index/Child.md'], ['Team', 'Team/index'], DocumentImportLayoutEnum.MARKDOWN_VAULT)).toEqual({
			'Team/index.md': [DocumentKindEnum.PAGE, null, 'Team'],
			'Team/index': [DocumentKindEnum.FOLDER, 'Team/index.md', 'index'],
			'Team/index/Child.md': [DocumentKindEnum.PAGE, 'Team/index', 'Child']
		});
	});

	it('reads an HTML export: ids stripped, the page holds its folder, HTML pages are pages', () => {
		const tree = shape(
			[`Roadmap ${ID}.html`, `Roadmap ${ID}/Q1 ${ID2}.html`, `Roadmap ${ID}/image.png`],
			[`Roadmap ${ID}`],
			DocumentImportLayoutEnum.HTML_EXPORT
		);
		expect(tree).toEqual({
			[`Roadmap ${ID}.html`]: [DocumentKindEnum.PAGE, null, 'Roadmap'],
			[`Roadmap ${ID}/Q1 ${ID2}.html`]: [DocumentKindEnum.PAGE, `Roadmap ${ID}.html`, 'Q1'],
			[`Roadmap ${ID}/image.png`]: [DocumentKindEnum.FILE, `Roadmap ${ID}.html`, 'image.png']
		});
	});

	it('keeps an HTML file of a vault as an attachment', () => {
		expect(shape(['Home.md', 'saved.html'], [], DocumentImportLayoutEnum.MARKDOWN_VAULT)['saved.html'][0]).toBe(DocumentKindEnum.FILE);
	});

	it('unwraps a single Export-<uuid> folder, but keeps a vault folder', () => {
		const wrapped = buildImportPlan(['Export-5d3c2b1a-0000/Home.md'], ['Export-5d3c2b1a-0000'], DocumentImportLayoutEnum.HTML_EXPORT);
		expect(wrapped.nodes.map((node) => [node.key, node.parentKey])).toEqual([['Export-5d3c2b1a-0000/Home.md', null]]);
		const vault = buildImportPlan(['MyVault/Home.md'], ['MyVault'], DocumentImportLayoutEnum.MARKDOWN_VAULT);
		expect(vault.nodes.map((node) => [node.key, node.parentKey])).toEqual([
			['MyVault', null],
			['MyVault/Home.md', 'MyVault']
		]);
	});

	it('gives every node a stable external id', () => {
		expect(externalIdOf('Vault/Home.md')).toBe(externalIdOf('Vault/Home.md'));
		expect(externalIdOf('Vault/Home.md')).not.toBe(externalIdOf('Vault/home.md'));
		expect(externalIdOf('x'.repeat(2000))).toHaveLength(64);
	});
});

describe('ImportLinkIndex', () => {
	const plan = buildImportPlan(
		[
			'Vault/Home.md',
			'Vault/Projects/Release checklist.md',
			'Vault/Archive/Release checklist.md',
			'Vault/Onboarding.md',
			'Vault/assets/diagram.png',
			'Vault/Projects/diagram.png',
			'Vault/spec.pdf',
			'Vault/v1.2 notes.md'
		],
		[],
		DocumentImportLayoutEnum.MARKDOWN_VAULT
	);
	const links = new ImportLinkIndex(plan);

	it('resolves a wiki link by name, case-insensitively', () => {
		expect(links.resolveWiki('onboarding', 'Vault/Home.md')).toEqual({ kind: 'page', key: 'Vault/Onboarding.md' });
		expect(links.resolveWiki('Onboarding.md', 'Vault/Home.md')).toEqual({ kind: 'page', key: 'Vault/Onboarding.md' });
		expect(links.resolveWiki('v1.2 notes', 'Vault/Home.md')).toEqual({ kind: 'page', key: 'Vault/v1.2 notes.md' });
	});

	it('prefers the linking page folder, then a path-qualified target', () => {
		expect(links.resolveWiki('Release checklist', 'Vault/Projects/Plan.md')).toEqual({ kind: 'page', key: 'Vault/Projects/Release checklist.md' });
		expect(links.resolveWiki('Archive/Release checklist', 'Vault/Home.md')).toEqual({ kind: 'page', key: 'Vault/Archive/Release checklist.md' });
	});

	it('honours the folder of a path-qualified link over the linking page folder', () => {
		const twins = new ImportLinkIndex(
			buildImportPlan(['Vault/A/Home.md', 'Vault/A/Page.md', 'Vault/B/Page.md'], [], DocumentImportLayoutEnum.MARKDOWN_VAULT)
		);
		expect(twins.resolveWiki('B/Page', 'Vault/A/Home.md')).toEqual({ kind: 'page', key: 'Vault/B/Page.md' });
		expect(twins.resolveWiki('A/Page', 'Vault/A/Home.md')).toEqual({ kind: 'page', key: 'Vault/A/Page.md' });
		// Unqualified, the linking page folder still wins.
		expect(twins.resolveWiki('Page', 'Vault/A/Home.md')).toEqual({ kind: 'page', key: 'Vault/A/Page.md' });
	});

	it('resolves an embed to an attachment by its file name, preferring the same folder', () => {
		expect(links.resolveWiki('diagram.png', 'Vault/Projects/Plan.md', true)).toEqual({ kind: 'file', key: 'Vault/Projects/diagram.png' });
		expect(links.resolveWiki('spec.pdf', 'Vault/Home.md', true)).toEqual({ kind: 'file', key: 'Vault/spec.pdf' });
		expect(links.resolveWiki('Onboarding', 'Vault/Home.md', true)).toEqual({ kind: 'page', key: 'Vault/Onboarding.md' });
	});

	it('returns null for a target the archive does not hold', () => {
		expect(links.resolveWiki('Nowhere', 'Vault/Home.md')).toBeNull();
		expect(links.resolveWiki('missing.png', 'Vault/Home.md', true)).toBeNull();
	});

	it('resolves relative links, escaped and with fragments, and refuses the rest', () => {
		expect(links.resolveRelative('Projects/Release%20checklist.md#steps', 'Vault/Home.md')).toEqual({ kind: 'page', key: 'Vault/Projects/Release checklist.md' });
		expect(links.resolveRelative('../Onboarding.md', 'Vault/Projects/Release checklist.md')).toEqual({ kind: 'page', key: 'Vault/Onboarding.md' });
		expect(links.resolveRelative('assets/diagram.png', 'Vault/Home.md')).toEqual({ kind: 'file', key: 'Vault/assets/diagram.png' });
		expect(links.resolveRelative('https://example.com/a.md', 'Vault/Home.md')).toBeNull();
		expect(links.resolveRelative('#heading', 'Vault/Home.md')).toBeNull();
		expect(links.resolveRelative('../../../etc/passwd', 'Vault/Home.md')).toBeNull();
	});

	it('resolves an HTML export link to the page that holds a folder', () => {
		const exportPlan = buildImportPlan([`Roadmap ${ID}.html`, `Roadmap ${ID}/Q1 ${ID2}.html`], [], DocumentImportLayoutEnum.HTML_EXPORT);
		const index = new ImportLinkIndex(exportPlan);
		expect(index.resolveRelative(`Roadmap%20${ID}/Q1%20${ID2}.html`, `Roadmap ${ID}.html`)).toEqual({ kind: 'page', key: `Roadmap ${ID}/Q1 ${ID2}.html` });
		expect(index.resolveRelative(`../Roadmap%20${ID}.html`, `Roadmap ${ID}/Q1 ${ID2}.html`)).toEqual({ kind: 'page', key: `Roadmap ${ID}.html` });
		expect(index.resolveWiki('Q1', `Roadmap ${ID}.html`)).toEqual({ kind: 'page', key: `Roadmap ${ID}/Q1 ${ID2}.html` });
	});
});
