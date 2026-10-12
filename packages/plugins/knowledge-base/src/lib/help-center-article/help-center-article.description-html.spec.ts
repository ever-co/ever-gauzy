/**
 * `@gauzy/core` is a barrel over the whole server core, so the same stubs as
 * `help-center-article.service.spec.ts` stand in for the two shapes this service uses. The allowlist
 * itself is covered by `packages/core/src/lib/core/html-sanitizer/rich-html-sanitizer.spec.ts`; what is
 * under test here is that EVERY write path of `descriptionHtml` goes through it.
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
		async update(id: any, input: any): Promise<any> {
			return { id, ...input };
		}
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
	// A FIXED return value, never a regex "sanitizer": this proves the write path delegates to the
	// allowlist without re-implementing (badly) what it does.
	sanitizeRichHtml: jest.fn(() => '<p>hello</p>')
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
import { sanitizeRichHtml } from '@gauzy/core';
import { HelpCenterArticleService } from './help-center-article.service';

const ARTICLE_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const DIRTY_HTML = '<p>hello</p><script>alert(1)</script>';
const CLEAN_HTML = '<p>hello</p>';

/**
 * GHSA-v79w-54p2-wmh5 — the reporter's second recommendation. `descriptionHtml` is stored HTML like the
 * legacy `data` column, but every write path persisted it verbatim: `PATCH /help-center-article/:id/description`
 * (now behind ORG_HELP_CENTER_EDIT) wrote whatever the editor sent, and restoring an old version copied
 * a row that may predate sanitizing straight back onto the article.
 */
describe('HelpCenterArticleService — descriptionHtml write paths', () => {
	function createService() {
		const setClauses: Record<string, any>[] = [];
		const queryBuilder: any = {
			update: jest.fn(() => queryBuilder),
			set: jest.fn((clauses: Record<string, any>) => {
				setClauses.push(clauses);
				return queryBuilder;
			}),
			where: jest.fn(() => queryBuilder),
			andWhere: jest.fn(() => queryBuilder),
			execute: jest.fn(async () => undefined)
		};
		const typeOrmRepository = { createQueryBuilder: jest.fn(() => queryBuilder) };
		const versionService = { create: jest.fn(async (input: any) => input) } as any;

		const service = new HelpCenterArticleService(typeOrmRepository as any, {} as any, versionService);

		return { service, setClauses, versionService };
	}

	beforeEach(() => {
		(sanitizeRichHtml as jest.Mock).mockClear();
	});

	it('sanitizes descriptionHtml when an article is created', async () => {
		const { service } = createService();

		await expect(service.create({ descriptionHtml: DIRTY_HTML } as any)).resolves.toEqual({
			descriptionHtml: CLEAN_HTML
		});
		expect(sanitizeRichHtml).toHaveBeenCalledWith(DIRTY_HTML);
	});

	it('sanitizes descriptionHtml on a plain update', async () => {
		const { service } = createService();
		const input: any = { descriptionHtml: DIRTY_HTML };

		await service.updateArticleById(ARTICLE_ID, input);

		expect(input.descriptionHtml).toBe(CLEAN_HTML);
	});

	it('sanitizes descriptionHtml on the versioned update', async () => {
		const { service } = createService();
		// The stubbed CRUD base has no `findOneOrFailByIdString`; the versioned update only uses it to
		// snapshot the row before writing.
		(service as any).findOneOrFailByIdString = jest.fn(async () => ({ record: { id: ARTICLE_ID } }));
		const input: any = { descriptionHtml: DIRTY_HTML };

		await service.updateWithVersioning(ARTICLE_ID, input);

		expect(input.descriptionHtml).toBe(CLEAN_HTML);
	});

	it('sanitizes descriptionHtml on the binary-description write, which bypasses CrudService entirely', async () => {
		const { service, setClauses } = createService();

		await service.updateDescriptionFields(ARTICLE_ID, {
			descriptionHtml: DIRTY_HTML,
			descriptionJson: '{"root":1}'
		});

		expect(setClauses).toEqual([{ descriptionHtml: CLEAN_HTML, descriptionJson: '{"root":1}' }]);
		expect(sanitizeRichHtml).toHaveBeenCalledWith(DIRTY_HTML);
	});

	it('CONTROL: the pre-fix write stored the payload verbatim', () => {
		// What `updateDescriptionFields` used to build, on the same input.
		const setClauses: Record<string, any> = {};
		const fields = { descriptionHtml: DIRTY_HTML };

		if (fields.descriptionHtml !== undefined) {
			setClauses.descriptionHtml = fields.descriptionHtml;
		}

		expect(setClauses.descriptionHtml).toContain('<script>');
		expect(sanitizeRichHtml).not.toHaveBeenCalled();
	});

	it('leaves a write that carries no descriptionHtml alone', async () => {
		const { service, setClauses } = createService();

		await service.updateDescriptionFields(ARTICLE_ID, { descriptionJson: '{"root":1}' });

		expect(setClauses).toEqual([{ descriptionJson: '{"root":1}' }]);
		expect(sanitizeRichHtml).not.toHaveBeenCalled();
	});
});
