/**
 * The cart a child resource's create names in its body, for `@Versioned({ identify })`.
 *
 * A line or a delivery choice created through its own route is a write to its CART — the addition
 * re-prices it, and the totals it re-prices are the cart's columns — so the version the caller states in
 * `If-Match` is the cart's, and the guard has to compare it against the cart the body's `cartId` names
 * rather than against the route's `:id` (there is none on a create) or the body's `id`. The guard runs
 * before the validation pipe, so the member is read raw and only a non-empty string is passed on; anything
 * else leaves the comparison to the conditional write, and the pipe then refuses the body.
 *
 * @param request The HTTP request.
 * @returns The cart's id, or undefined when the body does not name one.
 */
export function cartOfBody(request: any): string | undefined {
	const cartId = request?.body?.cartId;

	return typeof cartId === 'string' && cartId.trim() !== '' ? cartId : undefined;
}
