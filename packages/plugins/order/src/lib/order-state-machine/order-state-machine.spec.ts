import { BadRequestException } from '@nestjs/common';
import { FulfillmentStatus, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { IOrderTransitionContext, OrderActor, OrderStateMachine } from './order-state-machine';

/**
 * The order lifecycle, and the two statuses materialised from the order's own rows.
 *
 * `status` is written here and nowhere else, so this class is the single answer to "may this order
 * move there" — and the specification fixes that answer as a *table*, not as a handful of examples
 * (doc 10 §5.2, §5.5, §5.6). The suite therefore tests the table:
 *
 * - the successor set of every one of the eight statuses is pinned literally, straight from §5.2;
 * - every one of the sixty-four `(from, to)` pairs is driven, so a transition that was quietly made
 *   legal, or quietly made illegal, fails here rather than in production;
 * - a refusal carries `ORDER_STATUS_TRANSITION_INVALID` **and the set the caller could have asked
 *   for instead**, because an error that only says "no" cannot be acted on;
 * - each guard is exercised in isolation and its precedence over another guard is pinned;
 * - both derived statuses are tested branch by branch against the decision lists of §5.5 and §5.6,
 *   first-match-wins included — "captured and partly refunded" must resolve to `PARTIALLY_REFUNDED`,
 *   not to `CAPTURED`, and a rule that is reordered silently changes what a customer is told they owe.
 */

/** Every status the lifecycle knows, in the order the specification lists them. */
const ALL_STATUSES = [
	OrderStatus.DRAFT,
	OrderStatus.PENDING,
	OrderStatus.REQUIRES_ACTION,
	OrderStatus.CONFIRMED,
	OrderStatus.PROCESSING,
	OrderStatus.COMPLETED,
	OrderStatus.CANCELED,
	OrderStatus.ARCHIVED
];

/**
 * The transition table of doc 10 §5.2, written out as the specification states it.
 *
 * This is the expectation, not a restatement of the implementation: it is the mermaid diagram and the
 * transition table of the specification, transcribed.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	[OrderStatus.DRAFT]: [OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.CANCELED],
	[OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.REQUIRES_ACTION, OrderStatus.CANCELED],
	[OrderStatus.REQUIRES_ACTION]: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELED],
	[OrderStatus.CONFIRMED]: [
		OrderStatus.PROCESSING,
		OrderStatus.REQUIRES_ACTION,
		OrderStatus.COMPLETED,
		OrderStatus.CANCELED
	],
	[OrderStatus.PROCESSING]: [OrderStatus.REQUIRES_ACTION, OrderStatus.COMPLETED, OrderStatus.CANCELED],
	[OrderStatus.COMPLETED]: [OrderStatus.ARCHIVED],
	[OrderStatus.CANCELED]: [OrderStatus.ARCHIVED],
	[OrderStatus.ARCHIVED]: []
};

/**
 * A context in which every guard passes, so a transition can be tested without its guards.
 *
 * `SYSTEM` is the actor that may do the most, `isSettled` satisfies the completion guard, nothing has
 * shipped so a cancellation is still allowed, no approval is open, and the money side is `NOT_PAID` —
 * the state a confirmation admits of an order that owes nothing yet (doc 10 §5.2).
 */
const permitted = (overrides: Partial<IOrderTransitionContext> = {}): IOrderTransitionContext => ({
	actor: 'SYSTEM',
	hasCapture: false,
	hasShipped: false,
	isSettled: true,
	hasOpenApproval: false,
	hasShippableLines: true,
	fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
	paymentStatus: OrderPaymentStatus.NOT_PAID,
	...overrides
});

/** The response body a refusal carries. */
function refusalOf(call: () => unknown): { code?: string; message?: string; details?: any } {
	try {
		call();
	} catch (error) {
		expect(error).toBeInstanceOf(BadRequestException);

		return (error as BadRequestException).getResponse() as { code?: string; message?: string; details?: any };
	}

	throw new Error('the call was expected to be refused and was not');
}

describe('OrderStateMachine — the transition table (doc 10 §5.2)', () => {
	it('allows exactly the documented successors of every status', () => {
		for (const status of ALL_STATUSES) {
			expect(OrderStateMachine.allowedFrom(status)).toEqual(TRANSITIONS[status]);
		}
	});

	it('has an entry for every status the enum declares, and no others', () => {
		// A status missing from the table is indistinguishable from a terminal one, which is how a
		// status added to the enum ends up unreachable.
		expect([...ALL_STATUSES].sort()).toEqual(Object.values(OrderStatus).sort());
		expect(ALL_STATUSES.filter((status) => OrderStateMachine.allowedFrom(status).length === 0)).toEqual([
			OrderStatus.ARCHIVED
		]);
	});

	it('permits every transition in the table and refuses every one that is not', () => {
		// All sixty-four pairs, not a sample: a guard added to the wrong branch, or a successor that
		// was silently dropped, shows up as a pair on the wrong side of this loop.
		const driven: string[] = [];

		for (const from of ALL_STATUSES) {
			for (const to of ALL_STATUSES) {
				const allowed = TRANSITIONS[from].includes(to);
				const outcome = OrderStateMachine.canTransition(from, to, permitted());

				expect({ from, to, allowed: outcome }).toEqual({ from, to, allowed });
				driven.push(`${from}->${to}`);
			}
		}

		expect(driven).toHaveLength(ALL_STATUSES.length ** 2);
	});

	it('returns the timestamp that belongs to the status it moved to, and only that one', () => {
		const moves = [
			{ from: OrderStatus.DRAFT, to: OrderStatus.PENDING, field: 'placedAt' },
			{ from: OrderStatus.PROCESSING, to: OrderStatus.COMPLETED, field: 'completedAt' },
			{ from: OrderStatus.CONFIRMED, to: OrderStatus.CANCELED, field: 'canceledAt' }
		];

		for (const move of moves) {
			const result = OrderStateMachine.transition({ status: move.from }, move.to, permitted());

			expect(result.status).toBe(move.to);
			expect(result[move.field as 'placedAt']).toBeInstanceOf(Date);
			expect(Object.keys(result)).toEqual(['status', move.field]);
		}
	});

	it('moves a status that carries no timestamp without inventing one', () => {
		const result = OrderStateMachine.transition({ status: OrderStatus.DRAFT }, OrderStatus.DRAFT, permitted());

		expect(result).toEqual({ status: OrderStatus.DRAFT });
		expect(result.placedAt).toBeUndefined();
		expect(result.completedAt).toBeUndefined();
		expect(result.canceledAt).toBeUndefined();
	});

	it('repeats no state but a draft', () => {
		// A draft is edited in place through a change; every other order moves forward, so asking for
		// the status it already has is a caller error rather than a no-op.
		expect(OrderStateMachine.canTransition(OrderStatus.DRAFT, OrderStatus.DRAFT, permitted())).toBe(true);

		for (const status of ALL_STATUSES.filter((value) => value !== OrderStatus.DRAFT)) {
			expect({ status, allowed: OrderStateMachine.canTransition(status, status, permitted()) }).toEqual({
				status,
				allowed: false
			});
		}
	});

	it('refuses with the code and the set the caller could have asked for instead', () => {
		const response = refusalOf(() =>
			OrderStateMachine.transition({ status: OrderStatus.COMPLETED }, OrderStatus.PENDING, permitted())
		);

		expect(response.code).toBe('ORDER_STATUS_TRANSITION_INVALID');
		expect(response.message).toContain('COMPLETED');
		expect(response.message).toContain('PENDING');
		expect(response.details).toEqual({
			from: OrderStatus.COMPLETED,
			to: OrderStatus.PENDING,
			allowed: [OrderStatus.ARCHIVED]
		});
	});

	it('refuses a move out of an archived order, which is read-only', () => {
		const response = refusalOf(() =>
			OrderStateMachine.transition({ status: OrderStatus.ARCHIVED }, OrderStatus.PENDING, permitted())
		);

		expect(response.details?.allowed).toEqual([]);
	});
});

describe('OrderStateMachine — transition guards', () => {
	it('refuses to place a draft that already has a capture against it', () => {
		expect(
			OrderStateMachine.canTransition(OrderStatus.DRAFT, OrderStatus.PENDING, permitted({ hasCapture: true }))
		).toBe(false);
		expect(
			OrderStateMachine.canTransition(OrderStatus.DRAFT, OrderStatus.PENDING, permitted({ hasCapture: false }))
		).toBe(true);
	});

	it('refuses to confirm an order with an approval outstanding', () => {
		expect(
			OrderStateMachine.canTransition(
				OrderStatus.PENDING,
				OrderStatus.CONFIRMED,
				permitted({ hasOpenApproval: true })
			)
		).toBe(false);
		// The same order, once the approval is granted.
		expect(
			OrderStateMachine.canTransition(
				OrderStatus.PENDING,
				OrderStatus.CONFIRMED,
				permitted({ hasOpenApproval: false })
			)
		).toBe(true);
	});

	it('confirms only on the three money states the specification names', () => {
		// §5.2 allows a confirmation out of `AUTHORIZED`, `CAPTURED` and `NOT_PAID` and nothing else:
		// a payment that is still with the buyer, that failed, or that is only partly authorised or
		// captured is not an answer, and confirming it would promise a sale the platform has not been
		// paid for.
		const allowed = [OrderPaymentStatus.AUTHORIZED, OrderPaymentStatus.CAPTURED, OrderPaymentStatus.NOT_PAID];
		const refused = Object.values(OrderPaymentStatus).filter((status) => !allowed.includes(status));

		for (const paymentStatus of allowed) {
			expect({
				paymentStatus,
				allowed: OrderStateMachine.canTransition(
					OrderStatus.PENDING,
					OrderStatus.CONFIRMED,
					permitted({ paymentStatus })
				)
			}).toEqual({ paymentStatus, allowed: true });
		}

		for (const paymentStatus of refused) {
			expect({
				paymentStatus,
				allowed: OrderStateMachine.canTransition(
					OrderStatus.PENDING,
					OrderStatus.CONFIRMED,
					permitted({ paymentStatus })
				)
			}).toEqual({ paymentStatus, allowed: false });
		}
	});

	it('refuses to complete an order that is not settled', () => {
		expect(
			OrderStateMachine.canTransition(OrderStatus.CONFIRMED, OrderStatus.COMPLETED, permitted({ isSettled: false }))
		).toBe(false);
		expect(
			OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.COMPLETED, permitted({ isSettled: false }))
		).toBe(false);
		expect(
			OrderStateMachine.canTransition(OrderStatus.PROCESSING, OrderStatus.COMPLETED, permitted({ isSettled: true }))
		).toBe(true);
	});

	it('refuses to cancel anything that has shipped', () => {
		// The rule the whole post-purchase flow rests on: once something is on its way, the only ways
		// back are a return and a claim, never a cancellation.
		for (const from of [OrderStatus.CONFIRMED, OrderStatus.PROCESSING]) {
			expect({ from, allowed: OrderStateMachine.canTransition(from, OrderStatus.CANCELED, permitted({ hasShipped: true })) }).toEqual(
				{ from, allowed: false }
			);
			expect({ from, allowed: OrderStateMachine.canTransition(from, OrderStatus.CANCELED, permitted({ hasShipped: false })) }).toEqual(
				{ from, allowed: true }
			);
		}
	});

	it('refuses to cancel an order that was already returned', () => {
		// A fully returned order finishes as `COMPLETED`; a cancellation here would void a fulfilled
		// sale. The fulfillment status is the guard, not the order status.
		for (const fulfillmentStatus of [FulfillmentStatus.RETURNED, FulfillmentStatus.PARTIALLY_RETURNED]) {
			expect(
				OrderStateMachine.canTransition(
					OrderStatus.PROCESSING,
					OrderStatus.CANCELED,
					permitted({ fulfillmentStatus })
				)
			).toBe(false);
		}

		expect(
			OrderStateMachine.canTransition(
				OrderStatus.CONFIRMED,
				OrderStatus.CANCELED,
				permitted({ fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED })
			)
		).toBe(true);
	});

	it('archives only for staff or the system, never for a customer or a provider', () => {
		const allowedFor: Record<OrderActor, boolean> = {
			STAFF: true,
			SYSTEM: true,
			CUSTOMER: false,
			PROVIDER: false
		};

		for (const actor of Object.keys(allowedFor) as OrderActor[]) {
			expect({
				actor,
				allowed: OrderStateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.ARCHIVED, permitted({ actor }))
			}).toEqual({ actor, allowed: allowedFor[actor] });
		}
	});

	it('checks the table before it checks a guard', () => {
		// `PROCESSING` has no guard of its own — every caller that reaches it has already been
		// authorised — so a move the table does not contain must still be refused. A machine that
		// consulted the guards first would allow `DRAFT -> PROCESSING` here.
		expect(OrderStateMachine.canTransition(OrderStatus.DRAFT, OrderStatus.PROCESSING, permitted())).toBe(false);
		expect(OrderStateMachine.canTransition(OrderStatus.PENDING, OrderStatus.PROCESSING, permitted())).toBe(false);
		refusalOf(() =>
			OrderStateMachine.transition({ status: OrderStatus.DRAFT }, OrderStatus.PROCESSING, permitted())
		);
	});
});

describe('OrderStateMachine.derivePaymentStatus (doc 10 §5.5)', () => {
	/** The ledger inputs, settled unless the case says otherwise. */
	const ledger = (overrides: Record<string, unknown> = {}) => ({
		orderStatus: OrderStatus.CONFIRMED,
		grandTotal: 100,
		creditTotal: 0,
		authorized: 0,
		voided: 0,
		captured: 0,
		refunded: 0,
		hasRequiresMoreSession: false,
		hasPendingSession: false,
		hasFailedAttempt: false,
		hasTransactions: true,
		...overrides
	});

	it('derives every branch of the decision list', () => {
		const cases: Array<{ what: string; input: Record<string, unknown>; expected: OrderPaymentStatus }> = [
			{
				what: 'a cancelled order with nothing captured',
				input: { orderStatus: OrderStatus.CANCELED, authorized: 100 },
				expected: OrderPaymentStatus.CANCELED
			},
			{
				what: 'a cancelled order that was captured before it was cancelled',
				input: { orderStatus: OrderStatus.CANCELED, captured: 40 },
				expected: OrderPaymentStatus.PARTIALLY_CAPTURED
			},
			{ what: 'everything captured refunded', input: { captured: 100, refunded: 100 }, expected: OrderPaymentStatus.REFUNDED },
			{
				what: 'more refunded than captured',
				input: { captured: 100, refunded: 120 },
				expected: OrderPaymentStatus.REFUNDED
			},
			{
				what: 'part of a capture refunded',
				input: { captured: 100, refunded: 20 },
				expected: OrderPaymentStatus.PARTIALLY_REFUNDED
			},
			{ what: 'the whole amount captured', input: { captured: 100 }, expected: OrderPaymentStatus.CAPTURED },
			{ what: 'more than the whole amount captured', input: { captured: 120 }, expected: OrderPaymentStatus.CAPTURED },
			{ what: 'part of the amount captured', input: { captured: 60 }, expected: OrderPaymentStatus.PARTIALLY_CAPTURED },
			{
				what: 'the whole amount authorised',
				input: { authorized: 100 },
				expected: OrderPaymentStatus.AUTHORIZED
			},
			{
				what: 'part of the amount authorised',
				input: { authorized: 60 },
				expected: OrderPaymentStatus.PARTIALLY_AUTHORIZED
			},
			{
				what: 'an authorisation that was voided',
				input: { authorized: 100, voided: 100 },
				expected: OrderPaymentStatus.NOT_PAID
			},
			{
				what: 'a failed attempt on a pending order',
				input: { orderStatus: OrderStatus.PENDING, hasFailedAttempt: true },
				expected: OrderPaymentStatus.FAILED
			},
			{
				what: 'a failed attempt on an order that is past confirmation',
				input: { hasFailedAttempt: true },
				expected: OrderPaymentStatus.NOT_PAID
			},
			{ what: 'a session awaiting the buyer', input: { hasRequiresMoreSession: true }, expected: OrderPaymentStatus.AWAITING },
			{ what: 'a pending session', input: { hasPendingSession: true }, expected: OrderPaymentStatus.AWAITING },
			{ what: 'an empty ledger', input: { hasTransactions: false }, expected: OrderPaymentStatus.NOT_PAID }
		];

		for (const testCase of cases) {
			expect({ what: testCase.what, status: OrderStateMachine.derivePaymentStatus(ledger(testCase.input) as never) }).toEqual(
				{ what: testCase.what, status: testCase.expected }
			);
		}
	});

	it('decides in the documented order, so a capture is not mistaken for a settled one', () => {
		// Rule 3 (`PARTIALLY_REFUNDED`) precedes rule 5 (`PARTIALLY_CAPTURED`): an order that was
		// partly captured and partly refunded is described by what happened to the money, and a
		// deriver that tested `captured < payable` first would report `PARTIALLY_CAPTURED` and hide
		// the refund from every operator reading the order list.
		expect(OrderStateMachine.derivePaymentStatus(ledger({ captured: 60, refunded: 10 }) as never)).toBe(
			OrderPaymentStatus.PARTIALLY_REFUNDED
		);
		// Rule 1 precedes everything: a cancelled order with no capture is cancelled even though an
		// authorisation exists.
		expect(
			OrderStateMachine.derivePaymentStatus(
				ledger({ orderStatus: OrderStatus.CANCELED, authorized: 100, hasPendingSession: true }) as never
			)
		).toBe(OrderPaymentStatus.CANCELED);
	});

	it('measures what is payable net of the credit lines', () => {
		// `T = grandTotal - creditTotal` (doc 10 §5.5). An order covered entirely by a credit line has
		// nothing to capture and reports `NOT_PAID` with `outstandingTotal = 0`, rather than staying
		// `PARTIALLY_CAPTURED` forever.
		expect(
			OrderStateMachine.derivePaymentStatus(ledger({ grandTotal: 100, creditTotal: 100 }) as never)
		).toBe(OrderPaymentStatus.NOT_PAID);
		expect(
			OrderStateMachine.derivePaymentStatus(ledger({ grandTotal: 100, creditTotal: 100, captured: 0 }) as never)
		).toBe(OrderPaymentStatus.NOT_PAID);
		// And a capture has to cover the remainder, not the gross.
		expect(
			OrderStateMachine.derivePaymentStatus(
				ledger({ grandTotal: 100, creditTotal: 40, captured: 60 }) as never
			)
		).toBe(OrderPaymentStatus.CAPTURED);
		expect(
			OrderStateMachine.derivePaymentStatus(
				ledger({ grandTotal: 100, creditTotal: 40, captured: 30 }) as never
			)
		).toBe(OrderPaymentStatus.PARTIALLY_CAPTURED);
	});
});

describe('OrderStateMachine.deriveFulfillmentStatus (doc 10 §5.6)', () => {
	const quantities = (overrides: Record<string, unknown> = {}) => ({
		orderStatus: OrderStatus.CONFIRMED,
		orderedQuantity: 10,
		writtenOffQuantity: 0,
		dismissedQuantity: 0,
		fulfilledQuantity: 0,
		receivedReturnQuantity: 0,
		...overrides
	});

	it('derives every branch of the decision list', () => {
		const cases: Array<{ what: string; input: Record<string, unknown>; expected: FulfillmentStatus }> = [
			{
				what: 'a cancelled order',
				input: { orderStatus: OrderStatus.CANCELED, fulfilledQuantity: 10 },
				expected: FulfillmentStatus.CANCELED
			},
			{
				what: 'every ordered unit received back',
				input: { fulfilledQuantity: 10, receivedReturnQuantity: 10 },
				expected: FulfillmentStatus.RETURNED
			},
			{
				what: 'some units received back',
				input: { fulfilledQuantity: 10, receivedReturnQuantity: 3 },
				expected: FulfillmentStatus.PARTIALLY_RETURNED
			},
			{ what: 'every unit fulfilled', input: { fulfilledQuantity: 10 }, expected: FulfillmentStatus.FULFILLED },
			{ what: 'nothing left to fulfil', input: { orderedQuantity: 0 }, expected: FulfillmentStatus.FULFILLED },
			{
				what: 'some units fulfilled',
				input: { fulfilledQuantity: 4 },
				expected: FulfillmentStatus.PARTIALLY_FULFILLED
			},
			{ what: 'nothing fulfilled', input: {}, expected: FulfillmentStatus.NOT_FULFILLED }
		];

		for (const testCase of cases) {
			expect({
				what: testCase.what,
				status: OrderStateMachine.deriveFulfillmentStatus(quantities(testCase.input) as never)
			}).toEqual({ what: testCase.what, status: testCase.expected });
		}
	});

	it('decides in the documented order, so a return outranks a fulfilment', () => {
		// Rule 2 precedes rule 4: units that came back are not "fulfilled". A deriver that tested
		// `fulfilled >= netTarget` first would report `FULFILLED` for a fully returned order.
		expect(
			OrderStateMachine.deriveFulfillmentStatus(
				quantities({ fulfilledQuantity: 10, receivedReturnQuantity: 10 }) as never
			)
		).toBe(FulfillmentStatus.RETURNED);
	});

	it('shrinks the target by what was written off or dismissed', () => {
		// `netTarget = Q - W - D`: a unit the merchant gave up on is not owed, so an order whose
		// remaining units all shipped is fulfilled even though `fulfilledQuantity < orderedQuantity`.
		expect(
			OrderStateMachine.deriveFulfillmentStatus(
				quantities({ orderedQuantity: 10, writtenOffQuantity: 4, fulfilledQuantity: 6 }) as never
			)
		).toBe(FulfillmentStatus.FULFILLED);
		expect(
			OrderStateMachine.deriveFulfillmentStatus(
				quantities({ orderedQuantity: 10, dismissedQuantity: 4, fulfilledQuantity: 6 }) as never
			)
		).toBe(FulfillmentStatus.FULFILLED);
		// A short fulfilment is not fulfilled while the target still stands.
		expect(
			OrderStateMachine.deriveFulfillmentStatus(
				quantities({ orderedQuantity: 10, writtenOffQuantity: 4, fulfilledQuantity: 5 }) as never
			)
		).toBe(FulfillmentStatus.PARTIALLY_FULFILLED);
	});

	it('reports a fully written-off order as fulfilled rather than unfulfilled', () => {
		// Nothing is left to ship, so the order is done; reporting `NOT_FULFILLED` would leave it in
		// the picking queue for ever.
		expect(
			OrderStateMachine.deriveFulfillmentStatus(
				quantities({ orderedQuantity: 10, writtenOffQuantity: 10 }) as never
			)
		).toBe(FulfillmentStatus.FULFILLED);
	});
});
