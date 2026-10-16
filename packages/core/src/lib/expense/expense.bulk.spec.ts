/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CurrenciesEnum, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../api/bulk-executor.service';
import { readBulkOperation } from '../api/bulk.decorator';
import { FieldVisibility } from '../api/field-visibility.service';
import { RequestContext } from '../core/context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../idempotency/idempotency.policy';
import { EmployeeBelongsToOrganizationConstraint } from '../shared/validators/constraints/employee-belongs-to-organization.constraint';
import { OrganizationBelongsToUserConstraint } from '../shared/validators/constraints/organization-belongs-to-user.constraint';
import { ExpenseCreateHandler } from './commands/handlers/expense.create.handler';
import { ExpenseController } from './expense.controller';
import { ExpenseResolver } from './expense.resolver';

/**
 * `POST /expense/bulk` and `bulkCreateExpenses`: many expenses in one request, each recorded exactly as
 * `POST /expense` and `createExpense` record one.
 *
 * The handler under the batch is the real `ExpenseCreateHandler`, over a scripted store: an expense create
 * records the row and then recomputes its employee's average expense from that employee's statistics, so
 * what a batch must reproduce is both writes per item, in item order.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FOREIGN_ORGANIZATION = '00000000-0000-4000-8000-000000000003';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';

/** The grants of the caller, as the platform's field visibility reads them. */
function visibilityFor(granted: PermissionsEnum[]): FieldVisibility {
	return {
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}
	} as unknown as FieldVisibility;
}

/** Both surfaces over the real create handler and a scripted store that keeps nothing a thrown transaction wrote. */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const rows: Array<Record<string, any>> = [];
	const averages: Array<{ id: string; averageExpenses: number }> = [];

	const expenseService = {
		create: jest.fn(async (payload: Record<string, any>) => {
			const row = { ...payload, id: `expense-${rows.length + 1}`, tenantId: RequestContext.currentTenantId() };
			rows.push(row);

			return row;
		}),
		findOneByIdString: jest.fn(async (id: string) => rows.find((row) => row.id === id)),
		countStatistic: (data: number[]) =>
			data.length ? data.reduce((sum, value) => sum + value, 0) / data.length : 0
	};
	const employeeStatisticsService = {
		getStatisticsByEmployeeId: jest.fn(async (employeeId: string) => ({
			expenseStatistics: rows.filter((row) => row.employeeId === employeeId).map((row) => Number(row.amount))
		}))
	};
	const employeeService = {
		create: jest.fn(async (update: { id: string; averageExpenses: number }) => {
			averages.push(update);

			return update;
		})
	};
	const handler = new ExpenseCreateHandler(
		expenseService as never,
		employeeService as never,
		employeeStatisticsService as never
	);
	const commandBus = { execute: jest.fn((command) => handler.execute(command)) };

	const executor = new BulkExecutor(visibilityFor(options.granted ?? [PermissionsEnum.ORG_EXPENSES_EDIT]));

	return {
		rows,
		averages,
		controller: new ExpenseController(
			expenseService as never,
			{} as never,
			{} as never,
			commandBus as never,
			{} as never,
			executor
		),
		resolver: new ExpenseResolver(expenseService as never, {} as never, commandBus as never, {} as never, executor)
	};
}

/** An expense body as `POST /expense` takes it. */
const body = (amount: number, extra: Record<string, unknown> = {}): never =>
	({
		organizationId: ORGANIZATION,
		amount,
		currency: CurrenciesEnum.USD,
		...extra
	}) as never;

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
	jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence').mockImplementation(
		async (organizationId: string) => organizationId === ORGANIZATION
	);
	jest.spyOn(EmployeeBelongsToOrganizationConstraint.prototype, 'validate').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

describe('POST /expense/bulk — each item is POST /expense', () => {
	it('records each item and recomputes its employee’s average exactly as the single create does, in order', async () => {
		const batch = surfaces();
		const single = surfaces();
		const items = [body(10, { employeeId: EMPLOYEE }), body(30, { employeeId: EMPLOYEE }), body(5)];

		const result = await batch.controller.bulk({ items });

		for (const item of items) {
			await single.controller.create(item);
		}

		expect(result).toMatchObject({ total: 3, succeededCount: 3, failedCount: 0 });
		expect(result.succeeded.map((entry) => entry.id)).toEqual(['expense-1', 'expense-2', 'expense-3']);
		// The same rows and the same average recomputations as the three single creates — the second
		// average reads the first item's row, which is what applying the items one by one guarantees.
		expect(batch.rows.map((row) => [row.amount, row.employeeId])).toEqual(
			single.rows.map((row) => [row.amount, row.employeeId])
		);
		expect(batch.averages).toEqual([
			{ id: EMPLOYEE, averageExpenses: 10 },
			{ id: EMPLOYEE, averageExpenses: 20 }
		]);
		expect(batch.averages).toEqual(single.averages);
	});

	it('reports a refused item with the create route’s reason and records the rest', async () => {
		const { controller, rows } = surfaces();

		const result = await controller.bulk({
			items: [
				body(10),
				body(20, { currency: 'NOT-A-CURRENCY' }),
				body(30, { organizationId: FOREIGN_ORGANIZATION })
			]
		});

		expect(result.succeededCount).toBe(1);
		expect(result.failed.map((failure) => [failure.index, failure.code])).toEqual([
			[1, ApiErrorCode.VALIDATION_FAILED],
			[2, ApiErrorCode.VALIDATION_FAILED]
		]);
		expect(result.failed[1].message).toContain('is not associated with the specified organization');
		expect(rows.map((row) => row.amount)).toEqual([10]);
	});

	it('refuses an item naming another tenant exactly as the create route does', async () => {
		const { controller, rows } = surfaces();

		const result = await controller.bulk({ items: [body(10), body(20, { tenantId: OTHER_TENANT })] });

		expect(result.failed[0]).toMatchObject({ index: 1, code: ApiErrorCode.VALIDATION_FAILED });
		expect(result.failed[0].message).toContain('not associated with the requested tenant');
		expect(rows.map((row) => row.tenantId)).toEqual([TENANT]);
	});

	it('refuses an atomic batch before writing anything', async () => {
		const { controller, rows, averages } = surfaces();

		const refusal = await controller
			.bulk({ atomic: true, items: [body(10, { employeeId: EMPLOYEE }), body(20)] })
			.catch((thrown) => thrown);

		// Each item is ExpenseCreateCommand, which writes through its own repositories: no transaction could
		// roll the batch back as one, so the route refuses the flag instead of answering as though it were.
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect((refusal as ApiException).details).toEqual({ field: 'atomic', resource: 'expense' });
		expect(rows).toEqual([]);
		expect(averages).toEqual([]);
	});

	it('refuses a batch above its cap, and a caller without the create route’s grant, before recording anything', async () => {
		const capped = surfaces();
		const denied = surfaces({ granted: [PermissionsEnum.ORG_EXPENSES_VIEW] });

		const tooMany = await capped.controller
			.bulk({ items: Array.from({ length: 201 }, () => body(1)) })
			.catch((thrown) => thrown);
		const refused = await denied.controller.bulk({ items: [body(1)] }).catch((thrown) => thrown);

		expect((tooMany as ApiException).code).toBe(ApiErrorCode.BULK_LIMIT_EXCEEDED);
		expect((refused as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(capped.rows).toEqual([]);
		expect(denied.rows).toEqual([]);
	});
});

describe('bulkCreateExpenses — the same batch over GraphQL, each item `createExpense`', () => {
	it('records each item as `createExpense` does — facets as the identifiers the pivot is written from', async () => {
		const { resolver, rows } = surfaces();

		const payload = await resolver.bulkCreateExpenses({
			items: [
				{ organizationId: ORGANIZATION, amount: '10.00', currency: CurrenciesEnum.USD, tagIds: ['tag-1'] },
				{ organizationId: ORGANIZATION, amount: '12.50', currency: CurrenciesEnum.USD }
			] as never
		});

		expect(payload).toMatchObject({ succeeded: 2, failed: 0, total: 2 });
		expect(rows[0].tags).toEqual([{ id: 'tag-1' }]);
		expect(rows[0]).not.toHaveProperty('tagIds');
	});

	it('refuses an atomic batch before writing anything, exactly as the route does', async () => {
		const { resolver, rows } = surfaces();

		const refusal = await resolver
			.bulkCreateExpenses({
				atomic: true,
				items: [{ organizationId: ORGANIZATION, amount: '10.00', currency: CurrenciesEnum.USD }] as never
			})
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect(rows).toEqual([]);
	});
});

describe('the declarations both surfaces run the batch from', () => {
	it('declares the batch as a POST on its own path, under the grant the create route runs under', () => {
		expect(Reflect.getMetadata(PATH_METADATA, ExpenseController.prototype.bulk)).toBe('/bulk');
		expect(Reflect.getMetadata(METHOD_METADATA, ExpenseController.prototype.bulk)).toBe(RequestMethod.POST);
		expect(readBulkOperation(ExpenseController.prototype, 'bulk')).toEqual({
			resource: 'expense',
			maxItems: 200,
			permission: PermissionsEnum.ORG_EXPENSES_EDIT,
			atomic: false
		});
		// The create route states no permission of its own and runs under the controller's; so does the batch.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseController.prototype.create)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseController.prototype.bulk)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseController)).toEqual([
			PermissionsEnum.ORG_EXPENSES_EDIT
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseResolver.prototype.bulkCreateExpenses)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ExpenseResolver.prototype.createExpense)
		);
	});

	it('declares one retry scope on both surfaces, honoured and not demanded', () => {
		const route = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, ExpenseController.prototype.bulk);

		expect(route).toEqual({ scope: 'expense.bulk', required: false, resourceType: 'expense' });
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, ExpenseResolver.prototype.bulkCreateExpenses)).toEqual(
			route
		);
	});
});
