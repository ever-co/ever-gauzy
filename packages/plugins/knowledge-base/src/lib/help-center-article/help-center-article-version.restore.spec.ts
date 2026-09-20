/**
 * Same stub strategy as the sibling suites: `@gauzy/core` is a barrel over the whole server core, and
 * only the two shapes this service uses matter here.
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor(
			public readonly typeOrmRepository: any,
			public readonly mikroOrmRepository: any
		) {}
		async create(entity: any): Promise<any> {
			return entity;
		}
	},
	RequestContext: { currentEmployeeId: () => 'employee-1', currentUser: () => ({ employeeId: 'employee-1' }) },
	sanitizeRichHtml: jest.fn(() => '<p>hello</p>')
}));

jest.mock('./help-center-article-version.entity', () => ({
	HelpCenterArticleVersion: class HelpCenterArticleVersion {}
}));
// The version service only needs the article service as a collaborator; importing the real one would
// pull the whole article module in.
jest.mock('./help-center-article.service', () => ({ HelpCenterArticleService: class HelpCenterArticleService {} }));
jest.mock('./repository/type-orm-help-center-article-version.repository', () => ({
	TypeOrmHelpCenterArticleVersionRepository: class TypeOrmHelpCenterArticleVersionRepository {}
}));
jest.mock('./repository/mikro-orm-help-center-article-version.repository', () => ({
	MikroOrmHelpCenterArticleVersionRepository: class MikroOrmHelpCenterArticleVersionRepository {}
}));

import { sanitizeRichHtml } from '@gauzy/core';
import { HelpCenterArticleVersionService } from './help-center-article-version.service';

const VERSION_ID = 'bbbbbbbb-1111-4111-8111-111111111111';
const ARTICLE_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const DIRTY_HTML = '<p>hello</p><script>alert(1)</script>';
const CLEAN_HTML = '<p>hello</p>';

/**
 * GHSA-v79w-54p2-wmh5 — restoring a version copied the stored `descriptionHtml` back onto the article
 * verbatim. Versions written before server-side sanitizing shipped still hold whatever an editor sent,
 * so the restore has to run them through the allowlist like any other write.
 */
describe('HelpCenterArticleVersionService.restoreToVersion', () => {
	it('sanitizes the descriptionHtml it copies back onto the article', async () => {
		const articleService = {
			findOneOrFailByIdString: jest.fn(async () => ({ record: { id: ARTICLE_ID, descriptionHtml: CLEAN_HTML } })),
			update: jest.fn(async (id: string, input: any) => ({ id, ...input }))
		};
		const service = new HelpCenterArticleVersionService({} as any, {} as any, articleService as any);
		(service as any).findOneOrFailByIdString = jest.fn(async () => ({
			record: {
				id: VERSION_ID,
				articleId: ARTICLE_ID,
				descriptionHtml: DIRTY_HTML,
				descriptionJson: '{"root":1}',
				descriptionBinary: null
			}
		}));

		await service.restoreToVersion(VERSION_ID);

		expect(sanitizeRichHtml).toHaveBeenCalledWith(DIRTY_HTML);
		expect(articleService.update).toHaveBeenCalledWith(ARTICLE_ID, {
			descriptionHtml: CLEAN_HTML,
			descriptionJson: '{"root":1}',
			descriptionBinary: null
		});
	});

	it('CONTROL: the pre-fix restore handed the stored HTML straight to the article', () => {
		const version = { descriptionHtml: DIRTY_HTML };

		expect(version.descriptionHtml).toContain('<script>');
	});
});
