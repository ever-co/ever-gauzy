import '../entities/internal';

import { RequestContext } from '../context';
import { TenantBaseEntity } from '../entities/internal';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

const EMPLOYEE_ID = '1c2ba0be-6f33-4e1c-9cd0-6ed99d21c3ee';
const EMPLOYEE_FILTER = { employee: { id: EMPLOYEE_ID }, employeeId: EMPLOYEE_ID };

const tick = () => new Promise((resolve) => setImmediate(resolve));

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
		const store = new Map<string, unknown>();
		RequestContext['clsService'] = {
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
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
		await serviceA.bypass(async () => {
			expect(serviceA.employeeConditions()).toEqual({});
			expect(serviceB.employeeConditions()).toEqual(EMPLOYEE_FILTER);
		});

		expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
	});

	it('keeps the bypass open until the outermost block completes', async () => {
		await serviceA.bypass(async () => {
			await serviceA.bypass(async () => undefined);
			expect(serviceA.employeeConditions()).toEqual({});
		});

		expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
	});

	it('keeps the bypass while a concurrent block on the same service is still running', async () => {
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

	it('restores the filter when the callback rejects', async () => {
		await expect(
			serviceA.bypass(async () => {
				throw new Error('failed');
			})
		).rejects.toThrow('failed');

		expect(serviceA.employeeConditions()).toEqual(EMPLOYEE_FILTER);
	});
});
