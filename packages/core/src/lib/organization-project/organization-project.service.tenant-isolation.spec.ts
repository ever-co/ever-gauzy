import '../core/entities/internal';

import { randomUUID } from 'crypto';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectService } from './organization-project.service';
import { OrganizationProject } from './organization-project.entity';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import {
	assertCanReadOwnTenant,
	assertCannotClaimForeignRowOnWrite,
	assertCannotDeleteAcrossTenant,
	assertCannotReadAcrossTenant,
	assertCannotUpdateAcrossTenant,
	assertListExcludesOtherTenant
} from '../core/testing/tenant-isolation/tenant-isolation.assertions';

/**
 * Second application of the shared tenant-isolation harness (see
 * `packages/core/src/lib/core/testing/tenant-isolation`), for `OrganizationProjectService`. Unlike
 * `EmployeeService`, this service has several extra collaborators (role/event/activity-log/...)
 * used only by its overridden `create()`; every assertion here exercises the inherited
 * `TenantAwareCrudService` read/update/delete/save paths, so those collaborators are never called
 * and can stay as inert stand-ins.
 */
describe('OrganizationProjectService tenant isolation', () => {
	const { tenantA, tenantB } = createCrossTenantFixture();

	let repository: InMemoryTenantRepository<OrganizationProject>;
	let service: OrganizationProjectService;
	let ownProject: OrganizationProject;
	let foreignProject: OrganizationProject;
	let restore: () => void;

	beforeEach(() => {
		// `InMemoryTenantRepository` stands in for the TypeORM repository only, so pin that branch.
		// `ormType` is resolved from `DB_ORM` at module load; a `DB_ORM=mikro-orm` in the environment
		// would otherwise send every call to the inert MikroORM stand-in and fail the whole suite. The
		// dual-ORM run of these same assertions is `persistence-invariant.spec.ts`, against a real database.
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		repository = new InMemoryTenantRepository<OrganizationProject>(new Set(['id', 'tenantId', 'organizationId']));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const unused = {} as any;
		service = new OrganizationProjectService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			repository as any,
			unused, // mikroOrmOrganizationProjectRepository
			unused, // typeOrmOrganizationProjectEmployeeRepository
			unused, // typeOrmEmployeeRepository
			unused, // EventBus
			unused, // RoleService
			unused, // EmployeeService
			unused, // EntitySubscriptionService
			unused, // ActivityLogService
			unused // EmployeeRecentVisitService
		);

		ownProject = repository.seed({
			id: randomUUID(),
			tenantId: tenantA.tenantId,
			organizationId: tenantA.organizationId
		} as OrganizationProject);
		foreignProject = repository.seed({
			id: randomUUID(),
			tenantId: tenantB.tenantId,
			organizationId: tenantB.organizationId
		} as OrganizationProject);

		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('can read its own tenant project (positive control)', async () => {
		await assertCanReadOwnTenant(service, ownProject.id);
	});

	it('cannot read another tenant project by id', async () => {
		await assertCannotReadAcrossTenant(service, foreignProject.id);
	});

	it('cannot update another tenant project', async () => {
		await assertCannotUpdateAcrossTenant(service, foreignProject.id);
	});

	it('cannot delete another tenant project', async () => {
		await assertCannotDeleteAcrossTenant(service, foreignProject.id, () =>
			repository.all().some((row) => row.id === foreignProject.id)
		);
	});

	it('cannot claim another tenant project via save()', async () => {
		await assertCannotClaimForeignRowOnWrite(service, foreignProject.id);
	});

	it('list operations never surface another tenant project', async () => {
		await assertListExcludesOtherTenant(service, foreignProject.id);
	});
});
