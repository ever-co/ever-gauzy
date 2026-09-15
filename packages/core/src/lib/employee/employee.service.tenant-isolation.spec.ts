import '../core/entities/internal';

import { randomUUID } from 'crypto';
import { EmployeeService } from './employee.service';
import { Employee } from './employee.entity';
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
 * First application of the shared tenant-isolation harness (see
 * `packages/core/src/lib/core/testing/tenant-isolation`). Proves that `EmployeeService` — via the
 * `TenantAwareCrudService` it extends — never lets one tenant read, list, update, delete, or claim
 * another tenant's employee record.
 */
describe('EmployeeService tenant isolation', () => {
	const { tenantA, tenantB } = createCrossTenantFixture();

	let repository: InMemoryTenantRepository<Employee>;
	let service: EmployeeService;
	let ownEmployee: Employee;
	let foreignEmployee: Employee;
	let restore: () => void;

	beforeEach(() => {
		repository = new InMemoryTenantRepository<Employee>(new Set(['id', 'tenantId', 'organizationId']));
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new EmployeeService(repository as any, {} as any);

		ownEmployee = repository.seed({
			id: randomUUID(),
			tenantId: tenantA.tenantId,
			organizationId: tenantA.organizationId
		} as Employee);
		foreignEmployee = repository.seed({
			id: randomUUID(),
			tenantId: tenantB.tenantId,
			organizationId: tenantB.organizationId
		} as Employee);

		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => restore());

	it('can read its own tenant employee (positive control)', async () => {
		await assertCanReadOwnTenant(service, ownEmployee.id);
	});

	it('cannot read another tenant employee by id', async () => {
		await assertCannotReadAcrossTenant(service, foreignEmployee.id);
	});

	it('cannot update another tenant employee', async () => {
		await assertCannotUpdateAcrossTenant(service, foreignEmployee.id);
	});

	it('cannot delete another tenant employee', async () => {
		await assertCannotDeleteAcrossTenant(service, foreignEmployee.id, () =>
			repository.all().some((row) => row.id === foreignEmployee.id)
		);
	});

	it('cannot claim another tenant employee via save()', async () => {
		await assertCannotClaimForeignRowOnWrite(service, foreignEmployee.id);
	});

	it('list operations never surface another tenant employee', async () => {
		await assertListExcludesOtherTenant(service, foreignEmployee.id);
	});
});
