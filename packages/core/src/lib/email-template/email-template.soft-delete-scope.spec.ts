import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmailTemplateResolver } from './email-template.resolver';
import { EmailTemplateService } from './email-template.service';

/**
 * `softDeleteEmailTemplate` / `recoverEmailTemplate` (SEC-A-01, SEC-E-02).
 *
 * `EmailTemplateService` is a plain `CrudService`: `softRemove(id)` / `softRecover(id)` resolve the row by id alone.
 * The REST routes were fixed to pass the caller's tenant (GHSA-44pv-34gx-q9p4); the GraphQL fields were not — any
 * tenant admin (every self-registered owner on app.gauzy.co) could withdraw the platform's GLOBAL password-reset,
 * invite and verification templates, and every tenant without its own copy then got those e-mails empty; another
 * tenant's own templates could be withdrawn or restored the same way.
 *
 * The scope now lives in the service, so every caller — both protocols, and any future one — is held to it.
 * The real resolver and service over a real SQLite table with a global row and two tenants' rows.
 */

const TENANT_A = '7a2b3c4d-0000-4000-8000-00000000000a';
const TENANT_B = '7a2b3c4d-0000-4000-8000-00000000000b';

const EmailTemplateSchema = new EntitySchema<any>({
	name: 'EmailTemplate',
	tableName: 'email_template',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		languageCode: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

describe('email template soft-delete / recover stay inside the caller’s tenant', () => {
	let dataSource: DataSource;
	let templates: Repository<any>;
	let resolver: EmailTemplateResolver;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [EmailTemplateSchema],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		templates = dataSource.getRepository('EmailTemplate');
		await templates.save([
			{ id: 'global', name: 'password/html', languageCode: 'en', tenantId: null },
			{ id: 'own', name: 'password/html', languageCode: 'en', tenantId: TENANT_A },
			{ id: 'foreign', name: 'password/html', languageCode: 'en', tenantId: TENANT_B }
		]);

		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		resolver = new EmailTemplateResolver(new EmailTemplateService(templates as any, {} as any), {} as any, {} as any);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	const isDeleted = async (id: string) => !!(await templates.findOne({ where: { id }, withDeleted: true })).deletedAt;

	it('refuses to withdraw a global default template', async () => {
		// The failure scenario: the global password-reset template was withdrawn for every tenant.
		await expect(resolver.softDeleteEmailTemplate('global')).rejects.toBeInstanceOf(NotFoundException);
		expect(await isDeleted('global')).toBe(false);
	});

	it('refuses to withdraw another tenant’s template', async () => {
		await expect(resolver.softDeleteEmailTemplate('foreign')).rejects.toBeInstanceOf(NotFoundException);
		expect(await isDeleted('foreign')).toBe(false);
	});

	it('refuses to restore another tenant’s withdrawn template', async () => {
		await templates.softDelete({ id: 'foreign' });

		await expect(resolver.recoverEmailTemplate('foreign')).rejects.toBeInstanceOf(NotFoundException);
		expect(await isDeleted('foreign')).toBe(true);
	});

	it('withdraws and restores the caller’s own template', async () => {
		await resolver.softDeleteEmailTemplate('own');
		expect(await isDeleted('own')).toBe(true);

		await resolver.recoverEmailTemplate('own');
		expect(await isDeleted('own')).toBe(false);
	});
});
