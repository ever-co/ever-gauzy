import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum
} from '@gauzy/contracts';
import { mapHelpCenterArticle, mapHelpCenterNode, resolveArticleContent } from './help-center.mapper';

describe('mapHelpCenterNode (09 §6.3 + §7 cases 5/6)', () => {
	const base = {
		id: 'base-1',
		name: 'Product Docs',
		flag: 'base',
		icon: 'book-open-outline',
		privacy: 'eye-outline',
		language: 'en',
		color: '#ff8800',
		description: 'Everything about the product',
		data: 'legacy payload',
		index: 3,
		parentId: null
	};

	it('maps a base to a READY IMPORT folder preserving icon, color, description and order', () => {
		const { fields, warnings } = mapHelpCenterNode(base);

		expect(warnings).toEqual([]);
		expect(fields.kind).toBe(DocumentKindEnum.FOLDER);
		expect(fields.source).toBe(DocumentSourceEnum.IMPORT);
		expect(fields.status).toBe(DocumentStatusEnum.READY);
		expect(fields.knowledgeStatus).toBe(DocumentKnowledgeStatusEnum.NONE);
		expect(fields.externalSource).toBe('help-center');
		expect(fields.externalId).toBe('base-1');
		expect(fields.icon).toBe('book-open-outline');
		expect(fields.color).toBe('#ff8800');
		expect(fields.description).toBe('Everything about the product');
		expect(fields.index).toBe(3);
		expect(fields.visibility).toBe(DocumentVisibilityEnum.ORGANIZATION);
		expect(fields.metadata.legacy).toEqual({
			flag: 'base',
			language: 'en',
			data: 'legacy payload',
			privacy: 'eye-outline'
		});
	});

	it('maps the private icon to PRIVATE and always warns about the semantics tightening (§6.6)', () => {
		const { fields, warnings } = mapHelpCenterNode({ ...base, privacy: 'eye-off-outline' });

		expect(fields.visibility).toBe(DocumentVisibilityEnum.PRIVATE);
		expect(warnings).toContain('mapped-private');
	});

	it('warns orphaned-category when a category has no resolvable parent (§7 case 5)', () => {
		const { warnings } = mapHelpCenterNode(
			{ ...base, id: 'cat-1', flag: 'category', parentId: null },
			{ parentResolved: false }
		);
		expect(warnings).toContain('orphaned-category');
	});

	it('does not warn for a category whose parent resolved', () => {
		const { warnings } = mapHelpCenterNode(
			{ ...base, id: 'cat-2', flag: 'category', parentId: 'base-1' },
			{ parentResolved: true }
		);
		expect(warnings).toEqual([]);
	});

	it('warns mixed-flag-state for a base that sits under a resolved parent (§7 case 6)', () => {
		const { warnings } = mapHelpCenterNode({ ...base, parentId: 'base-0' }, { parentResolved: true });
		expect(warnings).toContain('mixed-flag-state');
	});

	it('defaults a missing index to 0', () => {
		const { fields } = mapHelpCenterNode({ id: 'n', name: 'N' });
		expect(fields.index).toBe(0);
	});
});

describe('mapHelpCenterArticle (09 §6.4 + §7 cases 4/8)', () => {
	const article = {
		id: 'article-1',
		name: 'Getting started',
		description: 'A short intro',
		data: '<p>Hello</p>',
		draft: false,
		privacy: false,
		index: 2,
		isLocked: true,
		color: '#123456',
		externalId: 'zendesk-42',
		categoryId: 'cat-1',
		ownedById: 'employee-1',
		authorEmployeeIds: ['employee-1', 'employee-2']
	};

	it('maps an article to a READY IMPORT page with legacy provenance in metadata', () => {
		const { fields } = mapHelpCenterArticle(article);

		expect(fields.kind).toBe(DocumentKindEnum.PAGE);
		expect(fields.source).toBe(DocumentSourceEnum.IMPORT);
		expect(fields.status).toBe(DocumentStatusEnum.READY);
		expect(fields.knowledgeStatus).toBe(DocumentKnowledgeStatusEnum.NONE);
		expect(fields.externalSource).toBe('help-center-article');
		expect(fields.externalId).toBe('article-1');
		expect(fields.index).toBe(2);
		expect(fields.isLocked).toBe(true);
		expect(fields.color).toBe('#123456');
		expect(fields.description).toBe('A short intro');
		// The legacy *integration* id must never be confused with our provenance key.
		expect(fields.metadata.legacy.externalId).toBe('zendesk-42');
		expect(fields.metadata.legacy.ownedById).toBe('employee-1');
		expect(fields.metadata.legacy.authorEmployeeIds).toEqual(['employee-1', 'employee-2']);
	});

	it('routes drafts to the review queue with reason manual and records the raw flag', () => {
		const { fields } = mapHelpCenterArticle({ ...article, draft: true });

		expect(fields.reviewStatus).toBe(DocumentReviewStatusEnum.PENDING);
		expect(fields.reviewReason).toBe(DocumentReviewReasonEnum.MANUAL);
		expect(fields.metadata.legacy.draft).toBe(true);
		// Drafts stay out of AI retrieval because nothing migrated is indexed at all.
		expect(fields.knowledgeStatus).toBe(DocumentKnowledgeStatusEnum.NONE);
	});

	it('maps privacy: true to PRIVATE with the mapped-private warning', () => {
		const { fields, warnings } = mapHelpCenterArticle({ ...article, privacy: true });

		expect(fields.visibility).toBe(DocumentVisibilityEnum.PRIVATE);
		expect(warnings).toContain('mapped-private');
		expect(fields.metadata.legacy.privacy).toBe(true);
	});
});

describe('resolveArticleContent (09 §6.4 content precedence)', () => {
	it('prefers descriptionJson verbatim and keeps the HTML as a fidelity copy', () => {
		const json = { type: 'doc', content: [{ type: 'paragraph' }] };
		const result = resolveArticleContent({
			id: 'a',
			name: 'A',
			descriptionJson: json,
			descriptionHtml: '<p>Hello</p>'
		});

		expect(result.contentJson).toBe(json);
		expect(result.contentHtml).toBe('<p>Hello</p>');
		expect(result.warnings).toEqual([]);
	});

	it('parses a serialized descriptionJson (SQLite text column)', () => {
		const result = resolveArticleContent({
			id: 'a',
			name: 'A',
			descriptionJson: '{"type":"doc","content":[]}'
		});

		expect(result.contentJson).toEqual({ type: 'doc', content: [] });
	});

	it('defers HTML→JSON conversion to the editor: sanitized HTML, null JSON, degraded warning', () => {
		const result = resolveArticleContent({
			id: 'a',
			name: 'A',
			data: '<p onclick="x()">Legacy</p><script>alert(1)</script>'
		});

		expect(result.contentJson).toBeNull();
		expect(result.contentHtml).toBe('<p>Legacy</p>');
		expect(result.warnings).toEqual(['html-conversion-degraded']);
	});

	it('prefers descriptionHtml over the legacy data column', () => {
		const result = resolveArticleContent({
			id: 'a',
			name: 'A',
			descriptionHtml: '<p>Rich</p>',
			data: '<p>Legacy</p>'
		});

		expect(result.contentHtml).toBe('<p>Rich</p>');
	});

	it('gives an empty article the canonical empty editor document (§7 case 4)', () => {
		const result = resolveArticleContent({ id: 'a', name: 'A', data: '<p>&nbsp;</p>' });

		expect(result.contentJson).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
		expect(result.contentHtml).toBeNull();
		expect(result.warnings).toEqual(['empty-content']);
	});

	it('starts a binary-only article from an empty document without an empty-content warning', () => {
		const result = resolveArticleContent({
			id: 'a',
			name: 'A',
			descriptionBinary: Uint8Array.from([1, 2, 3])
		});

		expect(result.contentJson).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
		expect(result.warnings).toEqual([]);
	});
});
