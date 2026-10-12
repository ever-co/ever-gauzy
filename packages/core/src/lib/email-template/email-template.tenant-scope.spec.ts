import '../core/entities/internal';

import {
	Brackets,
	DataSource,
	EntitySchema,
	IsNull,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder
} from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmailTemplateService } from './email-template.service';
import { scopeEmailTemplateWhere, stripEmailTemplateScopeFields } from './email-template.scope';

/**
 * GHSA-44pv-34gx-q9p4 — `EmailTemplateService` extends the plain `CrudService`, which adds no tenant
 * predicate of its own, and its reads trusted the client:
 *   - `findAll` added `tenantId = :tenantId` only when the CLIENT had sent `where.tenantId`, so
 *     `GET /api/email-template?where[languageCode]=en` listed EVERY tenant's templates;
 *   - `GET /api/email-template/pagination` handed the client `where` straight to `CrudService.paginate`,
 *     with no tenant predicate at all.
 * Both are now pinned to the caller's tenant plus the global (NULL-tenant) defaults.
 *
 * The cases run against a real better-sqlite3 database with the shipped `invalidWhereValuesBehavior`,
 * and each one is paired with a CONTROL that issues the PRE-FIX query shape over the same rows.
 */

const OrganizationSchema = new EntitySchema({
	name: 'Organization',
	tableName: 'organization',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		brandColor: { type: 'varchar', nullable: true },
		isActive: { type: 'boolean', default: true }
	}
});

// `EntitySchema<any>`: the generic infers its column names from `columns`, so a `relations` key it does
// not know is a compile error otherwise.
const EmailTemplateSchema = new EntitySchema<any>({
	name: 'EmailTemplate',
	tableName: 'email_template',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		name: { type: 'varchar' },
		languageCode: { type: 'varchar' },
		hbs: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	},
	relations: {
		organization: { type: 'many-to-one', target: 'Organization', joinColumn: { name: 'organizationId' } }
	}
});

const TENANT_A = '7a1b2c3d-0000-4000-8000-000000000001';
const TENANT_B = '7a1b2c3d-0000-4000-8000-000000000002';
const ORGANIZATION_A = 'org-a';
const ORGANIZATION_B = 'org-b';

describe('EmailTemplateService tenant scoping', () => {
	let dataSource: DataSource;
	let templates: Repository<any>;
	let service: EmailTemplateService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [OrganizationSchema, EmailTemplateSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		await dataSource.getRepository('Organization').save([
			{ id: ORGANIZATION_A, name: 'Organization A', isActive: true },
			{ id: ORGANIZATION_B, name: 'Organization B', isActive: true }
		]);

		templates = dataSource.getRepository('EmailTemplate');
		await templates.save([
			{ name: 'welcome/html', languageCode: 'en', tenantId: null, organizationId: null },
			{ name: 'welcome/html', languageCode: 'en', tenantId: TENANT_A, organizationId: ORGANIZATION_A },
			{ name: 'invite/html', languageCode: 'en', tenantId: TENANT_A, organizationId: null },
			{ name: 'welcome/html', languageCode: 'en', tenantId: TENANT_B, organizationId: ORGANIZATION_B }
		]);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		service = new EmailTemplateService(templates as any, {} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The tenant of every row a read returned, sorted, so a leak is named rather than counted. */
	const tenantsOf = (items: any[]): string[] => [...new Set(items.map((item) => item.tenantId ?? 'global'))].sort();

	it('lists the caller tenant plus the global defaults, even when the client sends no tenant', async () => {
		const { items } = await service.findAll({ where: { languageCode: 'en' } } as any);

		expect(tenantsOf(items)).toEqual([TENANT_A, 'global']);
	});

	it('CONTROL: the pre-fix findAll returned every tenant when the client omitted where.tenantId', async () => {
		// The pre-fix predicate, verbatim: the tenant arm ran only when the CLIENT sent `where.tenantId`.
		const where: any = { languageCode: 'en' };
		const query = templates.createQueryBuilder('email_template');
		query.where((qb: SelectQueryBuilder<any>) => {
			qb.where(
				new Brackets((web: WhereExpressionBuilder) => {
					if (where.tenantId) {
						web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId: TENANT_A });
					}
					if (where.languageCode) {
						web.andWhere(`"${qb.alias}"."languageCode" = :languageCode`, {
							languageCode: where.languageCode
						});
					}
				})
			);
			qb.orWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					web.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
				})
			);
		});
		const [items] = await query.getManyAndCount();

		expect(tenantsOf(items)).toEqual([TENANT_A, TENANT_B, 'global']);
	});

	it('keeps narrowing by the filters the client sends', async () => {
		const { items } = await service.findAll({
			where: { languageCode: 'en', organizationId: ORGANIZATION_A }
		} as any);

		// The organization arm narrows the tenant rows; the global defaults stay visible, as before.
		expect(
			items.map((item: any) => `${item.tenantId ?? 'global'}:${item.organizationId ?? 'none'}`).sort()
		).toEqual([`${TENANT_A}:${ORGANIZATION_A}`, 'global:none']);
	});

	it('pins the pagination route to the caller tenant and the global defaults', async () => {
		const { items } = await service.paginate({ where: { languageCode: 'en' } } as any);

		expect(tenantsOf(items)).toEqual([TENANT_A, 'global']);
	});

	it('CONTROL: the inherited paginate returned every tenant for the same request', async () => {
		// The pre-fix call shape: the client `where` straight into `CrudService.paginate`.
		const { items } = await CrudService.prototype.paginate.call(service, { where: { languageCode: 'en' } } as any);

		expect(tenantsOf(items)).toEqual([TENANT_A, TENANT_B, 'global']);
	});

	it('ignores a tenant the client names in the pagination filter', async () => {
		const { items } = await service.paginate({ where: { languageCode: 'en', tenantId: TENANT_B } } as any);

		expect(tenantsOf(items)).toEqual([TENANT_A, 'global']);
	});

	it('drops an organization relation filter instead of joining it', async () => {
		// `where[organization][isActive]=true` was the shape that cleared the membership validator; it
		// must not survive into the query either.
		const { items } = await service.paginate({
			where: { languageCode: 'en', organization: { isActive: true } }
		} as any);

		expect(tenantsOf(items)).toEqual([TENANT_A, 'global']);
	});
});

describe('scopeEmailTemplateWhere', () => {
	it('keeps the client filters, pins the tenant and ORs the global defaults (TypeORM)', () => {
		const where = scopeEmailTemplateWhere(
			{ languageCode: 'en', tenantId: TENANT_B, organizationId: ORGANIZATION_A },
			TENANT_A,
			MultiORMEnum.TypeORM
		);

		expect(where).toEqual([
			{ languageCode: 'en', organizationId: ORGANIZATION_A, tenantId: TENANT_A },
			{ languageCode: 'en', tenantId: IsNull(), organizationId: IsNull() }
		]);
	});

	it('uses $or and plain nulls on MikroORM, which compiles a null to IS NULL itself', () => {
		const where = scopeEmailTemplateWhere({ languageCode: 'en' }, TENANT_A, MultiORMEnum.MikroORM);

		expect(where).toEqual({
			$or: [
				{ languageCode: 'en', tenantId: TENANT_A },
				{ languageCode: 'en', tenantId: null, organizationId: null }
			]
		});
	});

	it('returns the global defaults only when there is no tenant in the request context', () => {
		expect(scopeEmailTemplateWhere({}, null, MultiORMEnum.TypeORM)).toEqual([
			{ tenantId: IsNull(), organizationId: IsNull() }
		]);
	});

	it('takes the organization id out of a relation-object filter and drops the rest of it', () => {
		expect(
			scopeEmailTemplateWhere(
				{ organization: { id: ORGANIZATION_A, isActive: true } },
				TENANT_A,
				MultiORMEnum.TypeORM
			)
		).toEqual([
			{ organizationId: ORGANIZATION_A, tenantId: TENANT_A },
			{ tenantId: IsNull(), organizationId: IsNull() }
		]);
	});
});

describe('stripEmailTemplateScopeFields', () => {
	it('removes every field that decides which tenant, organization or row a write lands on', () => {
		expect(
			stripEmailTemplateScopeFields({
				id: 'other-row',
				hbs: '<p>hi</p>',
				tenantId: TENANT_B,
				tenant: { id: TENANT_B },
				organizationId: ORGANIZATION_B,
				organization: { id: ORGANIZATION_B }
			})
		).toEqual({ hbs: '<p>hi</p>' });
	});
});
