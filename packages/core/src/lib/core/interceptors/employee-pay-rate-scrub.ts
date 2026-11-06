import { ExecutionContext, SetMetadata } from '@nestjs/common';

/**
 * The employee columns that hold salary data. A caller-supplied `select` (`?select[payRateValue]=true`, or nested
 * through a team's or a time log's employee) can load them on a generic read, so every serialized node loses them,
 * whatever else it carries: a `select` that leaves out `id` answers rows without one. Only the pay rate route, marked
 * with {@link RespondsWithPayRate}, answers them.
 */
export const EMPLOYEE_PAY_RATE_KEYS: ReadonlyArray<string> = ['payRateValue', 'payRateCurrency'];

/** The metadata key {@link RespondsWithPayRate} sets on a route handler. */
export const RESPONDS_WITH_PAY_RATE = 'gauzy:responds-with-pay-rate';

/**
 * Marks the one route whose answer is a pay rate (`GET /employee/:id/pay-rate`, which checks who may read it). The
 * response walk keeps the pay rate keys on that route's answer and removes them from every other response.
 */
export const RespondsWithPayRate = () => SetMetadata(RESPONDS_WITH_PAY_RATE, true);

/**
 * Whether the handler of a request is marked with {@link RespondsWithPayRate}.
 *
 * @param ctx The execution context of the request, if any.
 */
export function respondsWithPayRate(ctx: ExecutionContext | undefined): boolean {
	const handler = typeof ctx?.getHandler === 'function' ? ctx.getHandler() : undefined;
	if (!handler) {
		return false;
	}
	return Reflect.getMetadata(RESPONDS_WITH_PAY_RATE, handler) === true;
}

/**
 * Removes the pay rate from one serialized node, in place, unless the route answers a pay rate.
 *
 * @param node A plain object of a response body.
 * @param keepPayRate Whether the route is the pay rate route (see {@link RespondsWithPayRate}).
 */
export function scrubEmployeePayRate(node: Record<string, unknown>, keepPayRate = false): void {
	if (keepPayRate) {
		return;
	}
	for (const key of EMPLOYEE_PAY_RATE_KEYS) {
		delete node[key];
	}
}
