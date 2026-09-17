import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IOperation, IOperationStep, OperationStatus, OperationStepStatus } from '@gauzy/contracts';
import { firstValueFrom, of } from 'rxjs';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { AcceptedOperationInterceptor, readIdempotencyKey } from './accepted-operation.interceptor';
import {
	AsyncAccepted,
	IAcceptedOperationOptions,
	locateOperation,
	operationRefOf,
	toOperationView
} from './async-operation';

const declaration = (overrides: Partial<IAcceptedOperationOptions> = {}): IAcceptedOperationOptions => ({
	type: 'CHECKOUT_COMPLETE',
	...overrides
});

const reflectorFor = (options?: IAcceptedOperationOptions): Reflector =>
	({ getAllAndOverride: () => options }) as unknown as Reflector;

interface Captured {
	headers: Record<string, string>;
	status?: number;
}

const httpContext = (request: unknown, captured: Captured): ExecutionContext =>
	({
		getType: () => 'http',
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => ({
				setHeader: (name: string, value: string) => {
					captured.headers[name] = value;
				},
				status: (value: number) => {
					captured.status = value;
				}
			})
		})
	}) as unknown as ExecutionContext;

const returning = (value: unknown): CallHandler => ({ handle: () => of(value) }) as CallHandler;

const run = async (options: IAcceptedOperationOptions | undefined, request: unknown, value: unknown) => {
	const captured: Captured = { headers: {} };
	const interceptor = new AcceptedOperationInterceptor(reflectorFor(options));
	const body = await firstValueFrom(interceptor.intercept(httpContext(request, captured), returning(value)));

	return { body, captured };
};

describe('the accepted-operation convention', () => {
	it('answers 202 with the body, the Location and the Retry-After', async () => {
		const { body, captured } = await run(declaration(), { headers: { 'idempotency-key': 'key-1' } }, {
			operationId: '2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48',
			type: 'CHECKOUT_COMPLETE',
			status: 'PENDING'
		});

		expect(captured.status).toBe(HttpStatus.ACCEPTED);
		expect(captured.headers.Location).toBe('/api/operations/2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48');
		expect(captured.headers['Retry-After']).toBe('1');
		expect(body as AsyncAccepted).toEqual({
			operationId: '2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48',
			type: 'CHECKOUT_COMPLETE',
			status: 'PENDING',
			location: '/api/operations/2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48'
		});
	});

	it('requires an idempotency key before the handler runs', async () => {
		await expect(run(declaration(), { headers: {} }, { operationId: 'op-1' })).rejects.toMatchObject({
			code: ApiErrorCode.IDEMPOTENCY_KEY_REQUIRED,
			details: { header: 'Idempotency-Key' }
		});
	});

	it('reads the key from either the accessor or the headers, trimmed', () => {
		expect(readIdempotencyKey({ get: () => ' key-1 ' })).toBe('key-1');
		expect(readIdempotencyKey({ headers: { 'idempotency-key': 'key-2' } })).toBe('key-2');
		expect(readIdempotencyKey({ headers: { 'idempotency-key': '   ' } })).toBeUndefined();
		expect(readIdempotencyKey({})).toBeUndefined();
	});

	it('leaves a route that has not declared the convention untouched', async () => {
		const { body, captured } = await run(undefined, { headers: {} }, { id: 'row-1', title: 'A resource' });

		expect(body).toEqual({ id: 'row-1', title: 'A resource' });
		expect(captured.status).toBeUndefined();
	});

	it('passes a value that is not an operation reference through unchanged', async () => {
		const { body, captured } = await run(declaration(), { headers: { 'idempotency-key': 'key-1' } }, {
			id: 'row-1',
			title: 'A resource'
		});

		expect(body).toEqual({ id: 'row-1', title: 'A resource' });
		expect(captured.status).toBeUndefined();
	});

	it('resolves a retry to the same handle, because the reference is the operation', () => {
		const ref = { operationId: 'op-1', type: 'CHECKOUT_COMPLETE' };

		expect(locateOperation(ref).location).toBe(locateOperation(ref).location);
		expect(locateOperation(ref, { retryAfterSeconds: 5 }).retryAfterSeconds).toBe(5);
		expect(locateOperation(ref, { locationOf: (given) => `/internal/ops/${given.operationId}` }).location).toBe(
			'/internal/ops/op-1'
		);
	});

	it('refuses a reference whose type disagrees with the route declaration', () => {
		expect(() => locateOperation({ operationId: 'op-1', type: 'ORDER_CAPTURE' }, { declaredType: 'CHECKOUT_COMPLETE' })).toThrow(
			/declares the operation type/
		);
	});

	it('builds the reference from the operation the runtime started', () => {
		const ref = operationRefOf({
			id: 'op-1',
			type: 'CHECKOUT_COMPLETE',
			status: OperationStatus.COMPENSATING
		} as IOperation);

		// The backward walk has not settled the operation, so a caller is told to keep polling.
		expect(ref).toEqual({ operationId: 'op-1', type: 'CHECKOUT_COMPLETE', status: 'RUNNING' });
	});
});

describe('resolving the handle', () => {
	const steps = [
		{ name: 'validate-cart', order: 1, status: OperationStepStatus.COMPLETED, attemptCount: 1 },
		{ name: 'reserve-stock', order: 2, status: OperationStepStatus.RUNNING, attemptCount: 2 }
	] as unknown as IOperationStep[];

	const running = {
		id: 'op-1',
		type: 'CHECKOUT_COMPLETE',
		status: OperationStatus.RUNNING,
		attemptCount: 1,
		maxAttempts: 3,
		input: {},
		startedAt: new Date('2026-03-01T10:15:00.500Z'),
		deadlineAt: new Date('2026-03-01T10:16:00.500Z')
	} as unknown as IOperation;

	it('reports progress, the steps and a validator', () => {
		const view = toOperationView(running, steps);

		expect(view.progress).toEqual({ completedSteps: 1, totalSteps: 2 });
		expect(view.terminal).toBe(false);
		expect(view.steps.map((step) => step.name)).toEqual(['validate-cart', 'reserve-stock']);
		expect(view.startedAt).toBe('2026-03-01T10:15:00.500Z');
		expect(view.etag).toMatch(/^W\/"[0-9a-f]{8}"$/);
	});

	it('gives an unchanged operation the same validator and a moved one a different one', () => {
		const first = toOperationView(running, steps);
		const second = toOperationView({ ...running } as IOperation, steps);
		const completed = toOperationView({ ...running, status: OperationStatus.COMPLETED } as IOperation, steps);

		expect(second.etag).toBe(first.etag);
		expect(completed.etag).not.toBe(first.etag);
	});

	it('carries the result of a completed operation and the error of one that ended otherwise', () => {
		const completed = toOperationView(
			{ ...running, status: OperationStatus.COMPLETED, result: { orderId: 'o-1' } } as IOperation,
			steps
		);
		const compensated = toOperationView(
			{
				...running,
				status: OperationStatus.COMPENSATED,
				lastError: JSON.stringify({ code: 'PAYMENT_DECLINED', message: 'Declined.', retryable: false })
			} as IOperation,
			steps
		);

		expect(completed.terminal).toBe(true);
		expect(completed.result).toEqual({ orderId: 'o-1' });
		expect(compensated.terminal).toBe(true);
		expect(compensated.error).toEqual({ code: 'PAYMENT_DECLINED', message: 'Declined.', retryable: false });
	});

	it('does not report a failed operation as finished while the undo is still owed', () => {
		const failed = toOperationView({ ...running, status: OperationStatus.FAILED } as IOperation, steps);

		expect(failed.terminal).toBe(false);
	});
});
