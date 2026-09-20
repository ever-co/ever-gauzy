/**
 * The checkout session's retry safety, asserted through the two routes that adopt it.
 *
 * A checkout runs over several requests, and the two a client is expected to repeat are the one that
 * starts a session and the one that reports a step completed. Repeating either without a key is
 * already harmless — the session's own uniqueness rule returns the open session, and a step appends
 * once — so a key is optional here rather than mandatory; what the suite pins is that presenting one
 * is honoured, and that a repeat is answered from the first attempt's record instead of running the
 * handler again.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the other cart specs state: the
 * barrel boots an application graph this suite has no use for. Everything the convention is made of —
 * the interceptor and the metadata the decorator writes — is the real thing.
 */
jest.mock('./commerce-checkout-session.service', () => ({
	CommerceCheckoutSessionService: class CommerceCheckoutSessionService {}
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: nothing here is mapped onto a database or a module graph. */
	const decorator = () => () => undefined;

	/**
	 * The concurrency metadata key, taken from the kernel's own constant rather than restated as a
	 * string literal: a spec that spelled it out would keep passing after the decorator and the guard
	 * stopped agreeing on the key they use.
	 */
	const { VERSIONED_METADATA_KEY } = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

	/** The base controller, reduced to what a route inherits: the service it delegates to. */
	class CrudController {
		constructor(protected readonly service: any) {}
	}

	/** Every base class the DTOs extend, declared but never mapped onto anything. */
	class BaseEntity {}

	return {
		VERSIONED_METADATA_KEY,
		CrudController,
		Permissions: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		UUIDValidationPipe: class {},
		UseValidationPipe: decorator,
		VersionedColumn: decorator,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantBaseDTO: class {},
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		MultiORMEntity: decorator,
		MultiORMColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnIndex: decorator,
		ColumnNumericTransformerPipe: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		IDEMPOTENT_METADATA_KEY: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.policy')
			.IDEMPOTENT_METADATA_KEY,
		IdempotencyInterceptor: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotency.interceptor')
			.IdempotencyInterceptor
	};
});

jest.mock('@gauzy/core/src/lib/idempotency/idempotency.service', () => ({
	IdempotencyService: class IdempotencyService {}
}));

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom } from 'rxjs';
import { IDEMPOTENT_METADATA_KEY, IdempotencyInterceptor, VERSIONED_METADATA_KEY } from '@gauzy/core';
import { CommerceCheckoutSessionController } from './commerce-checkout-session.controller';

const SESSION_ID = 'session-1';

/**
 * An execution context over one controller method.
 *
 * @param handler The method the router dispatched to.
 * @param controller The controller class.
 * @param req The request.
 * @param res The response.
 */
function contextFor(handler: any, controller: any, req: any, res: any): ExecutionContext {
	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => controller,
		switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
		getArgByIndex: () => undefined
	} as unknown as ExecutionContext;
}

/**
 * A stand-in for the platform's idempotency store: the unique `(scope, key)` tuple and the recorded
 * response, which are the two things the interceptor depends on.
 */
function idempotencyStore() {
	const rows = new Map<string, any>();
	let sequence = 0;

	return {
		service: {
			claim: async (input: { scope: string; key: string; requestHash: string }) => {
				const identity = `${input.scope}:${input.key}`;
				const existing = rows.get(identity);

				if (!existing) {
					const record = { id: `claim-${++sequence}`, requestHash: input.requestHash, createdAt: new Date() };
					rows.set(identity, { record, status: 'IN_PROGRESS' });

					return { outcome: 'CLAIMED', record };
				}

				return existing.status === 'COMPLETED'
					? { outcome: 'REPLAYED', record: existing.record, response: existing.response }
					: { outcome: 'IN_FLIGHT', record: existing.record, retryAfterMs: 1_000 };
			},
			complete: async (recordId: string, completion: any) => {
				for (const row of rows.values()) {
					if (row.record.id === recordId) {
						row.status = 'COMPLETED';
						row.response = { status: completion.responseStatus, body: completion.responseBody };
					}
				}
			},
			fail: async (recordId: string, failure: any) => {
				for (const row of rows.values()) {
					if (row.record.id === recordId) {
						row.status = 'FAILED';
						row.response = { status: failure.responseStatus };
					}
				}
			}
		}
	};
}

describe('CommerceCheckoutSessionController — the retry-safe routes', () => {
	it('declares a scope on the two routes a client is expected to repeat, and none on the others', () => {
		const routes = CommerceCheckoutSessionController.prototype;
		const declared = (method: string) => Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, (routes as any)[method]);

		expect(declared('create')).toMatchObject({ scope: 'checkout.session.create', required: false });
		expect(declared('completeStep')).toMatchObject({ scope: 'checkout.step.complete', required: false });
		// A session is a single writer's progress record rather than an optimistically locked aggregate,
		// so no version is required of these routes.
		expect(Reflect.getMetadata(VERSIONED_METADATA_KEY, routes.completeStep)).toBeUndefined();
	});

	it('answers a repeated step with the first attempt’s record, so the step is recorded once', async () => {
		const store = idempotencyStore();
		const service = {
			completeStep: jest.fn(async (id: string, step: string) => ({
				id,
				step,
				completedSteps: [step],
				status: 'IN_PROGRESS'
			}))
		};
		const controller = new CommerceCheckoutSessionController(service as any);
		const interceptor = new IdempotencyInterceptor(store.service as any, new Reflector());
		let handled = 0;
		let current: any;
		const next: CallHandler = {
			handle: () => {
				handled++;

				return from(controller.completeStep(SESSION_ID, current.step, current.body));
			}
		};
		const attempt = () => {
			const req: any = {
				method: 'POST',
				url: `/api/checkout-sessions/${SESSION_ID}/steps/PAYMENT`,
				originalUrl: `/api/checkout-sessions/${SESSION_ID}/steps/PAYMENT`,
				query: {},
				params: { id: SESSION_ID, step: 'PAYMENT' },
				body: { card: 'tokenised' },
				headers: { 'idempotency-key': 'step-key-000001' },
				step: 'PAYMENT'
			};
			const res = { setHeader: jest.fn(), status: jest.fn() };
			current = req;

			return {
				res,
				run: lastValueFrom(
					interceptor.intercept(
						contextFor(CommerceCheckoutSessionController.prototype.completeStep, CommerceCheckoutSessionController, req, res),
						next
					)
				)
			};
		};

		const first = await attempt().run;
		const replay = attempt();
		const second = await replay.run;

		expect(handled).toBe(1);
		expect(service.completeStep).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
		expect(replay.res.setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
	});
});
