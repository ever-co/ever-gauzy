/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { OperationStatus, OperationStepStatus, PermissionsEnum } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { OperationController, IOperationDetail } from './operation.controller';

/**
 * The durable-operation inspector over REST.
 *
 * The suite pins the four things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is answered 401 by the global auth guard and a request whose credential holds no
 *   permission is refused by `TenantPermissionGuard` before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the assertion
 *   is about the decision and not about the decorator's prose. The two moves carry the move
 *   permission and never the read one, which is what makes "a caller who may look cannot cancel"
 *   true rather than intended;
 * - **the routes themselves** — each one is called and its delegation is asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may
 *   not do this" and "there is nothing here";
 * - **the list envelope** — the narrowing is pushed into the read and the page is applied to what it
 *   answered, which is the same rows and the same two numbers the GraphQL connection works with.
 *
 * **The controller under test is the real one**, over a scripted service, so a route that stopped
 * delegating — or delegated to something else — is caught here rather than accommodated.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OPERATION = '00000000-0000-4000-8000-000000000010';
const AGGREGATE = '00000000-0000-4000-8000-000000000030';

/** The operation a scripted service answers with, as the store hands it over. */
const STORED = {
	id: OPERATION,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	type: 'CHECKOUT_COMPLETE',
	status: OperationStatus.COMPENSATING,
	aggregateType: 'commerce_cart',
	aggregateId: AGGREGATE,
	attemptCount: 1,
	maxAttempts: 3,
	createdAt: new Date('2026-03-01T10:00:00.000Z')
};

/** The steps of that operation, as the step read answers them. */
const STEPS = [
	{ id: 'step-1', operationId: OPERATION, name: 'reserve_stock', order: 10, status: OperationStepStatus.COMPENSATED, attemptCount: 1 },
	{ id: 'step-2', operationId: OPERATION, name: 'authorize_payment', order: 20, status: OperationStepStatus.FAILED, attemptCount: 2 }
];

/**
 * The service, scripted per route.
 *
 * Every member the controller reaches is stated, so a route that calls something else fails loudly
 * rather than silently passing through an automock.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const operationService = {
		listOperations: jest.fn().mockResolvedValue([STORED]),
		findOperation: jest.fn().mockResolvedValue(STORED),
		findSteps: jest.fn().mockResolvedValue(STEPS),
		cancel: jest.fn().mockResolvedValue({ ...STORED, status: OperationStatus.COMPENSATED }),
		retry: jest.fn().mockResolvedValue({
			operation: { ...STORED, status: OperationStatus.COMPLETED },
			executedSteps: ['reserve_stock', 'authorize_payment'],
			finished: true
		}),
		...overrides
	};

	return {
		operationService,
		controller: new OperationController(operationService as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

describe('OperationController — the routes (API specification §7.3)', () => {
	it('lists the operations of the caller’s organization, narrowed and paged', async () => {
		const { controller, operationService } = surfaces();

		const answer = await controller.findAll({ status: OperationStatus.COMPENSATING, take: 10, skip: 0 });

		// The narrowing goes into the read and the page is applied to what it answered, which is what
		// keeps the REST answer and the GraphQL connection over one set of rows.
		expect(operationService.listOperations).toHaveBeenCalledWith({
			where: { status: OperationStatus.COMPENSATING }
		});
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('accepts the bracketed spelling of the same filter', async () => {
		const { controller, operationService } = surfaces();

		await controller.findAll({ filter: { type: 'CHECKOUT_COMPLETE', aggregateId: AGGREGATE } });

		expect(operationService.listOperations).toHaveBeenCalledWith({
			where: { type: 'CHECKOUT_COMPLETE', aggregateId: AGGREGATE }
		});
	});

	it('leaves a member that was not stated out of the criterion rather than writing it as undefined', async () => {
		const { controller, operationService } = surfaces();

		await controller.findAll();

		// A repository handed an explicit `undefined` asks for the rows whose column *is* null, which is
		// a different question from "do not narrow on this column".
		expect(operationService.listOperations).toHaveBeenCalledWith({ where: {} });
	});

	it('reads one operation with its step list attached', async () => {
		const { controller, operationService } = surfaces();

		const operation: IOperationDetail = await controller.findById(OPERATION);

		expect(operationService.findOperation).toHaveBeenCalledWith(OPERATION);
		expect(operationService.findSteps).toHaveBeenCalledWith(OPERATION);
		// The step list is what names the step a failure left, and it is the same relation the GraphQL
		// type answers as `steps`.
		expect(operation.steps).toEqual(STEPS);
		expect(operation.status).toBe(OperationStatus.COMPENSATING);
	});

	it('answers a miss with 404 rather than an empty operation', async () => {
		const { controller } = surfaces({ findOperation: jest.fn().mockResolvedValue(null) });

		const error = await controller.findById(OPERATION).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(NotFoundException);
		expect((error as NotFoundException).getStatus()).toBe(404);
		expect((error as Error).message).toContain('RESOURCE_NOT_FOUND');
	});

	it('cancels through the service method the GraphQL mutation calls, with the reason', async () => {
		const { controller, operationService } = surfaces();

		const canceled = await controller.cancel(OPERATION, { reason: 'the buyer withdrew' });

		// The reason is what the operation records, and the answer is the operation as the cancellation
		// left it — never a claim about work the runtime has not done yet.
		expect(operationService.cancel).toHaveBeenCalledWith(OPERATION, { reason: 'the buyer withdrew' });
		expect(canceled.status).toBe(OperationStatus.COMPENSATED);

		await controller.cancel(OPERATION);

		expect(operationService.cancel).toHaveBeenLastCalledWith(OPERATION, { reason: undefined });
	});

	it('retries through the service and answers the operation as the retry left it', async () => {
		const { controller, operationService } = surfaces();

		const retried = await controller.retry(OPERATION);

		// The delivered method answers what the pass did; the route answers the operation, which is the
		// row a caller asked to move.
		expect(operationService.retry).toHaveBeenCalledWith(OPERATION);
		expect(retried.status).toBe(OperationStatus.COMPLETED);
	});

	it('takes no body on the retry, so no argument states something the runtime decides', () => {
		// Read from the source, because a handler's signature is not metadata: the runtime's own rule
		// decides where a retry continues, from the persisted step statuses.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'operation.controller.ts'),
			'utf8'
		);

		expect(source).toMatch(/@Post\(':id\/retry'\)\n\tasync retry\(@Param\('id', UUIDValidationPipe\) id: ID\)/);
	});

	it('refuses a page above the protocol cap rather than answering every row', async () => {
		const { controller } = surfaces();

		const error = await controller.findAll({ take: 500 }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});

	it('surfaces the state machine’s own refusal as a 4xx that is not a 404', async () => {
		// A cancellation of a settled operation, and a retry of one that completed, are the two the
		// service refuses: both are "you may not do this" rather than "there is nothing here".
		const cancelRefusal = new ConflictException('The operation is compensated and cannot be cancelled.');
		const retryRefusal = new ConflictException(`The operation "${OPERATION}" is completed and has nothing to retry.`);

		for (const [member, refusal] of [
			['cancel', cancelRefusal],
			['retry', retryRefusal]
		] as const) {
			const { controller } = surfaces({ [member]: jest.fn().mockRejectedValue(refusal) });

			const error =
				member === 'cancel'
					? await controller.cancel(OPERATION).catch((thrown) => thrown)
					: await controller.retry(OPERATION).catch((thrown) => thrown);

			expect(isRefusal(error)).toBe(true);
			expect((error as HttpException).getStatus()).toBe(409);
		}
	});
});

describe('OperationController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', OperationController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource', () => {
		// The catalogue's own code for "read a durable operation and its steps". An operation is
		// infrastructure an operator inspects, and the platform declares a permission for exactly that
		// rather than leaving it to a general organization read.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, OperationController)).toEqual([
			PermissionsEnum.OPERATIONS_VIEW
		]);
	});

	it('gives every route the permission its capability carries', () => {
		const proto = OperationController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.OPERATIONS_VIEW],
			['findById', PermissionsEnum.OPERATIONS_VIEW],
			['cancel', PermissionsEnum.OPERATIONS_CANCEL],
			['retry', PermissionsEnum.OPERATIONS_CANCEL]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every move to a caller who holds only the read permission', () => {
		// A cancellation runs compensation and can reverse work that has already been performed, which
		// is why the catalogue gives it a code of its own: this asserts that a caller who may look at
		// the queue cannot act on it.
		const proto = OperationController.prototype;

		for (const route of ['cancel', 'retry']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.OPERATIONS_VIEW);
			expect(stated).toEqual([PermissionsEnum.OPERATIONS_CANCEL]);
		}
	});

	it('declares no route that writes an operation outside the runtime', () => {
		// Read from the source: a create, an update or a delete would be a plan a request could write or
		// an audit trail a request could erase, and neither is a capability this resource offers.
		const source = require('node:fs').readFileSync(
			require('node:path').join(__dirname, 'operation.controller.ts'),
			'utf8'
		);

		expect(source).not.toMatch(/@(Post|Put|Delete)\(\)/);
		expect(source).not.toMatch(/@Put\(/);
		expect(source).not.toMatch(/@Delete\(/);
	});
});
