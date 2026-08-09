/**
 * `@gauzy/core` is a barrel over the whole server core — importing it for real pulls the ORM
 * bootstrap, the request context and every entity into the test runtime. Only the two shapes this
 * service actually uses matter here, so stubs stand in: a minimal CRUD base class and a
 * `sanitizeRichHtml` double. The real allowlist has its own coverage in
 * `packages/core/src/lib/core/html-sanitizer/rich-html-sanitizer.spec.ts`; what is under test here
 * is the READ path — that the service runs the corpus through the allowlist at all, and heals the
 * stored row exactly once.
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor(public readonly typeOrmRepository: any, public readonly mikroOrmRepository: any) {}
		async find(): Promise<any[]> {
			return [];
		}
	},
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: () => 'tenant-1', currentEmployeeId: () => 'employee-1' },
	parseFindOptionsRelations: (value: any) => value,
	parseFindOptionsSelect: (value: any) => value,
	prepareSQLQuery: (value: string) => value,
	LIKE_OPERATOR: 'ILIKE',
	// Strips anything that is not a paragraph — enough of a stand-in to make "did the read path
	// sanitize?" observable without re-testing the real allowlist.
	sanitizeRichHtml: jest.fn((html: string) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''))
}));

jest.mock('./help-center-article.entity', () => ({ HelpCenterArticle: class HelpCenterArticle {} }));
jest.mock('./help-center-article-version.entity', () => ({
	HelpCenterArticleVersion: class HelpCenterArticleVersion {}
}));
jest.mock('./help-center-article-version.service', () => ({
	HelpCenterArticleVersionService: class HelpCenterArticleVersionService {}
}));
jest.mock('./repository/type-orm-help-center-article.repository', () => ({
	TypeOrmHelpCenterArticleRepository: class TypeOrmHelpCenterArticleRepository {}
}));
jest.mock('./repository/mikro-orm-help-center-article.repository', () => ({
	MikroOrmHelpCenterArticleRepository: class MikroOrmHelpCenterArticleRepository {}
}));

import { ID } from '@gauzy/contracts';
import { HelpCenterArticleService } from './help-center-article.service';

const CATEGORY_ID = 'cccccccc-1111-4111-8111-111111111111' as ID;
const DIRTY_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const CLEAN_ID = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;

const DIRTY_HTML = '<p>hello</p><script>alert(1)</script>';
const CLEAN_HTML = '<p>hello</p>';

/**
 * Builds the service with per-test doubles. `find` is the only base-class call the read path makes,
 * so it is stubbed straight onto the instance.
 */
function createService(rows: any[]) {
	const typeOrmRepository = { update: jest.fn(async () => undefined) };
	const mikroOrmRepository = {};
	const versionService = {} as any;

	const service = new HelpCenterArticleService(typeOrmRepository as any, mikroOrmRepository as any, versionService);
	jest.spyOn(service as any, 'find').mockResolvedValue(rows);

	return { service, typeOrmRepository };
}

describe('HelpCenterArticleService — legacy `data` read path', () => {
	beforeEach(() => jest.clearAllMocks());

	it('sanitizes article HTML on the way out of getArticlesByCategoryId', async () => {
		const { service } = createService([{ id: DIRTY_ID, data: DIRTY_HTML }]);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBe(CLEAN_HTML);
		expect(article.data).not.toContain('<script');
	});

	it('lazily re-saves the cleaned HTML for rows the allowlist actually changed', async () => {
		const { service, typeOrmRepository } = createService([{ id: DIRTY_ID, data: DIRTY_HTML }]);

		await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(typeOrmRepository.update).toHaveBeenCalledTimes(1);
		expect(typeOrmRepository.update).toHaveBeenCalledWith(DIRTY_ID, { data: CLEAN_HTML });
	});

	it('never re-writes a row that was already clean', async () => {
		const { service, typeOrmRepository } = createService([{ id: CLEAN_ID, data: CLEAN_HTML }]);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBe(CLEAN_HTML);
		expect(typeOrmRepository.update).not.toHaveBeenCalled();
	});

	it('leaves rows with no `data` untouched', async () => {
		const { service, typeOrmRepository } = createService([{ id: CLEAN_ID, data: null }]);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBeNull();
		expect(typeOrmRepository.update).not.toHaveBeenCalled();
	});

	it('still returns sanitized content when the lazy re-save fails', async () => {
		const { service, typeOrmRepository } = createService([{ id: DIRTY_ID, data: DIRTY_HTML }]);
		typeOrmRepository.update.mockRejectedValue(new Error('db down'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBe(CLEAN_HTML);
	});
});
