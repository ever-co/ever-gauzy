import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary: the base
 * the knowledge-base services inherit is reduced to the switch it states, the read that answers a miss, and the
 * organization boundary a case confines the caller to. The boundary itself — who it confines, and how every read,
 * write and delete of the base keeps to it, a delete by id of a row outside it answering `affected: 0` — is proven
 * against real stores on both ORMs in core (`tenant-aware-crud.service.organization-boundary.spec.ts`). What is proven
 * here is that the knowledge-base services ask for it, that the article's hand-written description queries keep to
 * it, and what the services do when a read misses. **The knowledge-base base and services under test are the real
 * ones.**
 */
const ORG = '00000000-0000-4000-8000-000000000002';
const ARTICLE_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const VERSION_ID = 'bbbbbbbb-1111-4111-8111-111111111111';

/** The boundary a case confines the caller to: none (a tenant admin, a job) unless the case states one. */
const confinement: { boundary: { organizationId: string | null } | null } = { boundary: null };

jest.mock('@gauzy/core', () => {
	class TenantAwareCrudService {
		constructor(
			public readonly typeOrmRepository: any,
			public readonly mikroOrmRepository: any
		) {}

		/** Off in the platform's base: a service applies the boundary only when it says so. */
		protected appliesOrganizationBoundary(): boolean {
			return false;
		}

		/** The boundary that applies to this service right now. */
		protected organizationBoundary(): unknown {
			return this.appliesOrganizationBoundary() ? confinement.boundary : null;
		}

		/** A read that misses, as the base answers a row that does not exist or lies outside the boundary. */
		async findOneOrFailByIdString(): Promise<unknown> {
			return { success: false, error: new Error('The requested record was not found') };
		}
	}

	return {
		TenantAwareCrudService,
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		RequestContext: {
			currentTenantId: () => 'tenant-1',
			currentEmployeeId: () => 'employee-1',
			currentUser: () => null
		},
		parseFindOptionsRelations: (value: unknown) => value,
		parseFindOptionsSelect: (value: unknown) => value,
		prepareSQLQuery: (value: string) => value,
		LIKE_OPERATOR: 'ILIKE',
		sanitizeRichHtml: (html: string) => html
	};
});
jest.mock('./help-center-article/help-center-article.entity', () => ({ HelpCenterArticle: class {} }));
jest.mock('./help-center-article/help-center-article-version.entity', () => ({
	HelpCenterArticleVersion: class {}
}));
jest.mock('./help-center-article/repository/type-orm-help-center-article.repository', () => ({
	TypeOrmHelpCenterArticleRepository: class {}
}));
jest.mock('./help-center-article/repository/mikro-orm-help-center-article.repository', () => ({
	MikroOrmHelpCenterArticleRepository: class {}
}));
jest.mock('./help-center-article/repository/type-orm-help-center-article-version.repository', () => ({
	TypeOrmHelpCenterArticleVersionRepository: class {}
}));
jest.mock('./help-center-article/repository/mikro-orm-help-center-article-version.repository', () => ({
	MikroOrmHelpCenterArticleVersionRepository: class {}
}));

import { NotFoundException } from '@nestjs/common';
import { KnowledgeBaseCrudService } from './knowledge-base-crud.service';
import { HelpCenterArticleService } from './help-center-article/help-center-article.service';
import { HelpCenterArticleVersionService } from './help-center-article/help-center-article-version.service';

class HelpCenterAuthorService extends KnowledgeBaseCrudService<any> {
	applies(): boolean {
		return this.appliesOrganizationBoundary();
	}
}

/** Every `*.service.ts` file under a folder. */
function serviceFiles(folder: string): string[] {
	return readdirSync(folder).flatMap((name) => {
		const path = join(folder, name);
		if (statSync(path).isDirectory()) {
			return serviceFiles(path);
		}
		return name.endsWith('.service.ts') ? [path] : [];
	});
}

/** An article service over a query builder that records every condition it is given. */
function articleFixture() {
	const conditions: Array<[string, Record<string, unknown>?]> = [];
	const writes: unknown[] = [];
	const queryBuilder: any = {
		select: () => queryBuilder,
		update: () => queryBuilder,
		set: () => queryBuilder,
		where: (sql: string, params?: Record<string, unknown>) => {
			conditions.push([sql, params]);
			return queryBuilder;
		},
		andWhere: (sql: string, params?: Record<string, unknown>) => {
			conditions.push([sql, params]);
			return queryBuilder;
		},
		getOne: async () => null,
		execute: async () => undefined
	};
	const versionService = {
		create: async (input: unknown) => {
			writes.push(input);
			return input;
		}
	};
	const service = new HelpCenterArticleService(
		{ createQueryBuilder: () => queryBuilder } as never,
		{} as never,
		versionService as never
	);

	return { service, conditions, writes };
}

describe('KnowledgeBaseCrudService — the knowledge-base services keep every caller inside the organization boundary', () => {
	beforeEach(() => {
		confinement.boundary = null;
	});

	it('applies the platform’s organization boundary', () => {
		expect(new HelpCenterAuthorService(undefined as never, undefined as never).applies()).toBe(true);
	});

	it('is the base of every knowledge-base service: none extends the tenant-aware base directly', () => {
		const direct = serviceFiles(__dirname)
			.filter((path) => !path.endsWith('knowledge-base-crud.service.ts'))
			.filter((path) => /extends\s+TenantAwareCrudService\b/.test(readFileSync(path, 'utf8')));

		expect(direct).toEqual([]);
	});

	it('keeps a confined caller’s description read and write to their organization and the tenant’s own', async () => {
		confinement.boundary = { organizationId: ORG };
		const { service, conditions } = articleFixture();

		await service.getDescriptionBinary(ARTICLE_ID);
		await service.updateDescriptionFields(ARTICLE_ID, { descriptionJson: '{"root":1}' });

		expect(conditions).toContainEqual([
			'(article.organizationId = :boundaryOrganizationId OR article.organizationId IS NULL)',
			{ boundaryOrganizationId: ORG }
		]);
		expect(conditions).toContainEqual([
			'("organizationId" = :boundaryOrganizationId OR "organizationId" IS NULL)',
			{ boundaryOrganizationId: ORG }
		]);
	});

	it('keeps the description of a caller with no organization in their token to the tenant’s own articles', async () => {
		confinement.boundary = { organizationId: null };
		const { service, conditions } = articleFixture();

		await service.getDescriptionBinary(ARTICLE_ID);
		await service.updateDescriptionFields(ARTICLE_ID, { descriptionJson: '{"root":1}' });

		expect(conditions).toContainEqual(['article.organizationId IS NULL', {}]);
		expect(conditions).toContainEqual(['"organizationId" IS NULL', {}]);
	});

	it('does not narrow a tenant admin’s description read and write to their token’s organization', async () => {
		const { service, conditions } = articleFixture();

		await service.getDescriptionBinary(ARTICLE_ID);
		await service.updateDescriptionFields(ARTICLE_ID, { descriptionJson: '{"root":1}' });

		expect(conditions.filter(([sql]) => sql.includes('organizationId'))).toEqual([]);
	});

	it('answers a versioned update, a duplicate and a version restore whose read misses with 404, and writes nothing', async () => {
		const { service, writes } = articleFixture();
		const versions = new HelpCenterArticleVersionService({} as never, {} as never, service);

		await expect(service.updateWithVersioning(ARTICLE_ID, { name: 'Renamed' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(service.duplicate(ARTICLE_ID)).rejects.toBeInstanceOf(NotFoundException);
		await expect(versions.restoreToVersion(VERSION_ID)).rejects.toBeInstanceOf(NotFoundException);
		expect(writes).toEqual([]);
	});
});
