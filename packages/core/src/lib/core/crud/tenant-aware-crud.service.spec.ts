import '../entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { RequestContext } from '../context';
import { TenantBaseEntity } from '../entities/internal';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

const EMPLOYEE_ID = '1c2ba0be-6f33-4e1c-9cd0-6ed99d21c3ee';
const EMPLOYEE_FILTER = { employee: { id: EMPLOYEE_ID }, employeeId: EMPLOYEE_ID };

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Stands in for nestjs-cls, which stores values per async context rather than per process. */
const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
const inRequest = <R>(callback: () => Promise<R>): Promise<R> => requestStorage.run(new Map(), callback);

abstract class TestCrudService extends TenantAwareCrudService<TenantBaseEntity> {
	constructor() {
		super({ metadata: { hasColumnWithPropertyPath: () => true } } as any, {} as any);
	}

	employeeConditions() {
		return this['findConditionsWithEmployeeByUser']();
	}

	bypass<R>(callback: () => Promise<R>): Promise<R> {
		return this.withoutEmployeeFilter(callback);
	}
}

class ServiceA extends TestCrudService {}
class ServiceB extends TestCrudService {}

describe('TenantAwareCrudService.withoutEmployeeFilter', () => {
	const originalClsService = RequestContext['clsService'];
	let serviceA: ServiceA;
	let serviceB: ServiceB;

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as any;

		serviceA = new ServiceA();
		serviceB = new ServiceB();

		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		jest.restoreAllMocks();
	});

	it('leaves other services filtered while a bypass is open', async () => {
		await inRequest(async () => {
			await serviceA.bypass(async () => {
				expect(serviceA.employeeConditions()).toEqual({});
				expect(serviceB.employeeConditions()).toEqual(EMPLOYEE_FILTER);
			});

			expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
		});
	});

	it('leaves another instance of the same class filtered while a bypass is open', async () => {
		const otherInstance = new ServiceA();

		await inRequest(async () => {
			await serviceA.bypass(async () => {
				expect(serviceA.employeeConditions()).toEqual({});
				expect(otherInstance.employeeConditions()).toEqual(EMPLOYEE_FILTER);
			});
		});
	});

	it('keeps the bypass open until the outermost block completes', async () => {
		await inRequest(async () => {
			await serviceA.bypass(async () => {
				await serviceA.bypass(async () => undefined);
				expect(serviceA.employeeConditions()).toEqual({});
			});

			expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
		});
	});

	it('keeps the bypass while a concurrent block on the same service is still running', async () => {
		await inRequest(async () => {
			let conditionsInsideLongBlock: unknown;

			await Promise.all([
				serviceA.bypass(async () => {
					await tick();
				}),
				serviceA.bypass(async () => {
					await tick();
					await tick();
					conditionsInsideLongBlock = serviceA.employeeConditions();
				})
			]);

			expect(conditionsInsideLongBlock).toEqual({});
			expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
		});
	});

	it('does not leak the bypass into a concurrent request', async () => {
		let conditionsInOtherRequest: unknown;

		await Promise.all([
			inRequest(async () => {
				await serviceA.bypass(async () => {
					await tick();
					await tick();
				});
			}),
			inRequest(async () => {
				await tick();
				conditionsInOtherRequest = serviceA.employeeConditions();
			})
		]);

		expect(conditionsInOtherRequest).toEqual(EMPLOYEE_FILTER);
	});

	it('restores the filter when the callback rejects', async () => {
		await inRequest(async () => {
			await expect(
				serviceA.bypass(async () => {
					throw new Error('failed');
				})
			).rejects.toThrow('failed');

			expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
		});
	});
});

/**
 * The two guarantees `update` carries beyond the base class, and the reason each is stated as the
 * statement's own rather than a read's.
 *
 * The tenant conditions used to be enforced only by the read that preceded the write, which left the
 * `UPDATE` itself unscoped; and because that read decides by raising, a criterion naming a `version`
 * was answered "not found" for a row that existed and had merely moved on — which is the one answer a
 * conditional write must never give.
 */
describe('TenantAwareCrudService.update', () => {
	const originalClsService = RequestContext['clsService'];

	/** A service over a table that records what the update was asked to change. */
	function service(overrides: Record<string, unknown> = {}) {
		const table = {
			metadata: { hasColumnWithPropertyPath: () => true },
			update: jest.fn(async () => ({ affected: 1 })),
			findOne: jest.fn(async () => ({ id: 'row-1', tenantId: 'tenant-1', organizationId: 'org-1' })),
			findOneBy: jest.fn(async () => ({ id: 'row-1', tenantId: 'tenant-1', organizationId: 'org-1' })),
			...overrides
		};

		class Service extends TenantAwareCrudService<TenantBaseEntity> {
			constructor() {
				super(table as any, {} as any);
			}
		}

		return { service: new Service(), table };
	}

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as any;

		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ tenantId: 'tenant-1' } as any);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		jest.restoreAllMocks();
	});

	it('scopes the update with the tenant, so the statement is what excludes another tenant', async () => {
		const { service: crud, table } = service();

		await inRequest(() => crud.update('row-1', { name: 'renamed' } as any));

		// Control: the criteria the UPDATE runs with carry the scoping. Enforced by the read alone, a
		// caller that assembled its own criteria reached whatever row it named.
		expect(table.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'row-1', tenantId: 'tenant-1' }),
			{ name: 'renamed' }
		);
	});

	it('does not read the row first when the criteria state a version', async () => {
		const { service: crud, table } = service();

		await inRequest(() => crud.update({ id: 'row-1', version: 3 } as any, { name: 'renamed' } as any));

		// The version is a precondition the UPDATE evaluates, so the affected-row count is what decides
		// the outcome. A read here would raise for a row that merely moved on, and the concurrency
		// kernel's conflict would never be seen.
		expect(table.findOneBy).not.toHaveBeenCalled();
		expect(table.update).toHaveBeenCalledTimes(1);
		// The scoping is still merged in — skipping the read is not skipping the scope.
		expect(table.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'row-1', version: 3, tenantId: 'tenant-1' }),
			{ name: 'renamed' }
		);
	});

	it('still reads the row first when the criteria are only a locator', async () => {
		const { service: crud, table } = service();

		await inRequest(() => crud.update({ name: 'a name' } as any, { note: 'x' } as any));

		// Control for the case above: a criterion that does not state a precondition keeps the platform's
		// refusal-instead-of-a-silent-no-op behaviour.
		expect(table.findOneBy).toHaveBeenCalledTimes(1);
	});

	it('reads the row by identifier before updating it', async () => {
		const { service: crud, table } = service();

		await inRequest(() => crud.update('row-1', { note: 'x' } as any));

		// The identifier path reads through `findOne` rather than `findOneBy`, which is the shape the two
		// CRUD reads have always had: the assertion is on the read happening, not on which of the two
		// spellings it uses.
		expect(table.findOne).toHaveBeenCalledTimes(1);
		expect(table.update).toHaveBeenCalledTimes(1);
	});
});
