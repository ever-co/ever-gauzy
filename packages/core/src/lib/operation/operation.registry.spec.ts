import { IOperationDefinition, IOperationStepDefinition } from './operation.contract';
import { OperationRegistry, OperationTypeUnknownError } from './operation.registry';

/**
 * The durable-operation registry, asserted as the admission gate it is.
 *
 * A plugin registers its operation definitions at bootstrap and the executor refuses to start a type
 * nobody registered, because half-executing a plan nothing knows how to undo leaves an aggregate
 * stranded. That makes registration-time validation load-bearing: a definition that is wrong is a
 * deployment mistake and has to fail at startup, not halfway through a checkout. The second property
 * here is that a refused definition leaves the registry *unchanged* — a rejected type must not be
 * half-registered, or the next lookup would return a plan that was never accepted.
 */

const step = (name: string, order: number): IOperationStepDefinition => ({ name, order, invoke: async () => undefined });

const definition = (...steps: IOperationStepDefinition[]): IOperationDefinition => ({ steps });

/** Runs a call and reports what it did, so a case can assert on both halves. */
function attempt(call: () => void): { threw: boolean; error?: Error } {
	try {
		call();

		return { threw: false };
	} catch (error) {
		return { threw: true, error: error as Error };
	}
}

describe('registration and lookup', () => {
	it('resolves a registered type to its definition and reports an unregistered one as unknown', () => {
		const registry = new OperationRegistry();
		const plan = definition(step('reserve', 1), step('charge', 2), step('confirm', 3));

		registry.register('CHECKOUT_COMPLETE', plan);

		expect(registry.has('CHECKOUT_COMPLETE')).toBe(true);
		expect(registry.has('CHECKOUT_ABANDON')).toBe(false);
		expect(registry.get('CHECKOUT_COMPLETE')).toBe(plan);
		expect(registry.get('CHECKOUT_ABANDON')).toBeUndefined();
		expect(registry.require('CHECKOUT_COMPLETE')).toBe(plan);
		expect(registry.types()).toEqual(['CHECKOUT_COMPLETE']);
	});

	it('keeps the declaration order of its types, so a conflict report reads deterministically', () => {
		const registry = new OperationRegistry();

		registry.register('C', definition(step('s', 1)));
		registry.register('A', definition(step('s', 1)));
		registry.register('B', definition(step('s', 1)));

		expect(registry.types()).toEqual(['C', 'A', 'B']);
	});

	it('finds a step by name, and reports a step a definition no longer declares as absent', () => {
		const registry = new OperationRegistry();

		registry.register('CHECKOUT_COMPLETE', definition(step('reserve', 1), step('charge', 2)));

		expect(registry.stepOf('CHECKOUT_COMPLETE', 'charge')?.order).toBe(2);
		expect(registry.stepOf('CHECKOUT_COMPLETE', 'refund')).toBeUndefined();
		// A persisted step can outlive its definition, so this has to answer rather than throw.
		expect(registry.stepOf('CHECKOUT_ABANDON', 'charge')).toBeUndefined();
	});

	it('refuses an unknown type in a way a caller can branch on', () => {
		const registry = new OperationRegistry();
		const outcome = attempt(() => registry.require('NEVER_REGISTERED'));

		expect(outcome.threw).toBe(true);
		expect(outcome.error).toBeInstanceOf(OperationTypeUnknownError);
		expect((outcome.error as OperationTypeUnknownError).code).toBe('OPERATION_TYPE_UNKNOWN');
		expect((outcome.error as OperationTypeUnknownError).type).toBe('NEVER_REGISTERED');
		expect(outcome.error?.name).toBe('OperationTypeUnknownError');
		expect(outcome.error?.message).toContain('NEVER_REGISTERED');
	});

	it('is idempotent for the same definition and refuses a different one behind the same type', () => {
		const registry = new OperationRegistry();
		const plan = definition(step('reserve', 1));

		registry.register('TYPE', plan);

		// A module loaded twice must not fail startup.
		expect(attempt(() => registry.register('TYPE', plan)).threw).toBe(false);
		expect(registry.get('TYPE')).toBe(plan);

		const conflicting = attempt(() => registry.register('TYPE', definition(step('capture', 1))));

		expect(conflicting.threw).toBe(true);
		// A conflicting registration must not overwrite a working plan.
		expect(registry.get('TYPE')?.steps[0].name).toBe('reserve');
	});

	it('keeps two registries independent', () => {
		const first = new OperationRegistry();
		const second = new OperationRegistry();

		first.register('ONLY_IN_FIRST', definition(step('s', 1)));

		expect(second.has('ONLY_IN_FIRST')).toBe(false);
		expect(first.has('ONLY_IN_FIRST')).toBe(true);
	});
});

describe('what a definition must state to be executable', () => {
	const malformed: [string, () => [string, IOperationDefinition]][] = [
		['an empty type', () => ['', definition(step('s', 1))]],
		['a missing definition', () => ['TYPE', undefined as unknown as IOperationDefinition]],
		['a definition with no steps property', () => ['TYPE', {} as IOperationDefinition]],
		['a definition whose steps are not an array', () => ['TYPE', { steps: 'reserve' } as unknown as IOperationDefinition]],
		['an empty step list, which has nothing to execute', () => ['TYPE', definition()]],
		['a step with no name', () => ['TYPE', definition({ order: 1, invoke: async () => undefined } as unknown as IOperationStepDefinition)]],
		['a step with an empty name', () => ['TYPE', definition({ name: '', order: 1, invoke: async () => undefined })]],
		['a step with no invoke handler', () => ['TYPE', definition({ name: 'a', order: 1 } as IOperationStepDefinition)]],
		[
			'a step whose invoke is not a function',
			() => ['TYPE', definition({ name: 'a', order: 1, invoke: 'reserve' } as unknown as IOperationStepDefinition)]
		],
		['a null step', () => ['TYPE', definition(null as unknown as IOperationStepDefinition)]],
		['two steps with the same name', () => ['TYPE', definition(step('a', 1), step('a', 2))]],
		// Equal orders would leave the execution order undefined, and the compensating walk is the
		// reverse of it — so the order has to be total, not merely sorted.
		['two steps at the same order', () => ['TYPE', definition(step('a', 1), step('b', 1))]],
		['two steps at the same order of zero', () => ['TYPE', definition(step('a', 0), step('b', 0))]]
	];

	for (const [label, build] of malformed) {
		it(`refuses ${label} and leaves the registry unchanged`, () => {
			const registry = new OperationRegistry();
			const [type, plan] = build();
			const outcome = attempt(() => registry.register(type, plan));

			expect(outcome.threw).toBe(true);
			expect(registry.has(type)).toBe(false);
			expect(registry.types()).toEqual([]);
		});
	}

	it('accepts an order that is unsorted but total, and keeps the declaration order', () => {
		const registry = new OperationRegistry();

		registry.register('UNSORTED', definition(step('third', 10), step('first', 5), step('second', 7)));

		expect(registry.has('UNSORTED')).toBe(true);
		// The steps are kept as declared rather than silently re-sorted: the executor is what walks
		// them, and it is the layer that knows the running order.
		expect(registry.get('UNSORTED')?.steps.map((entry) => entry.name)).toEqual(['third', 'first', 'second']);
	});

	it('accepts order zero and a negative order, because only a tie is ambiguous', () => {
		const registry = new OperationRegistry();

		registry.register('ZERO_ORDER', definition(step('only', 0)));
		registry.register('NEGATIVE_ORDER', definition(step('a', -2), step('b', -1)));

		expect(registry.has('ZERO_ORDER')).toBe(true);
		expect(registry.has('NEGATIVE_ORDER')).toBe(true);
	});

	it('runs no handler merely by registering', () => {
		const registry = new OperationRegistry();
		const invoked: string[] = [];

		registry.register(
			'MANY',
			definition(
				...Array.from({ length: 50 }, (_unused, index) => ({
					name: `step-${index}`,
					order: index,
					invoke: async (): Promise<void> => {
						invoked.push(`step-${index}`);
					}
				}))
			)
		);

		expect(registry.get('MANY')?.steps).toHaveLength(50);
		expect(invoked).toEqual([]);

		registry.require('MANY').steps.forEach((entry) => entry.invoke(undefined, undefined as never));

		expect(invoked).toHaveLength(50);
		expect(invoked[0]).toBe('step-0');
		expect(invoked[49]).toBe('step-49');
	});
});
