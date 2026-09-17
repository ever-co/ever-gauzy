/**
 * The HTTP details this domain reads directly.
 *
 * Kept out of the services on purpose: a version precondition is a property of the request, not of
 * the aggregate, and a service that read a header would be unusable from the GraphQL surface.
 */

/**
 * Reads the version a caller acted on out of an `If-Match` header.
 *
 * The header is the platform's optimistic-concurrency precondition, and this domain's documents take
 * it on every transition because two buyers acting on one purchase order is a real situation: the one
 * who read version 3 and sends the order must not overwrite the version 4 that the other one created
 * by amending it.
 *
 * @param value The raw header value, when the request carried one.
 * @returns The version it states, or undefined when it states none this domain can read. A weak
 * validator (`W/"3"`) and a quoted value are both accepted, because both are valid HTTP.
 */
export function parseIfMatch(value?: string): number | undefined {
	if (!value) {
		return undefined;
	}

	const cleaned = value.trim().replace(/^W\//i, '').replace(/"/g, '');
	const version = Number.parseInt(cleaned, 10);

	return Number.isInteger(version) && version > 0 ? version : undefined;
}
