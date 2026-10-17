import { ID } from '@gauzy/contracts';

/**
 * The port an order asks, at placement, what right each of its lines grants (Q7-W5).
 *
 * Declared here because the order is the caller; bound by the installation's composition module to the
 * entitlement package's adapter, so neither package imports the other. Unbound — the worker, or an
 * installation without the entitlement package — an order announces no lines, which is what every order
 * did before this port existed.
 */
export const ORDER_LINE_ENTITLEMENT_POLICY = 'ORDER_LINE_ENTITLEMENT_POLICY';

/**
 * How many lines an `order.placed` event carries at most.
 *
 * A line that grants a right is always carried — the grant path cannot read the order's tables, so a line
 * left out is a right never granted — and the cap applies to the lines that grant nothing.
 */
export const ORDER_PLACED_LINES_CAP = 500;

/** A right a line grants, as the catalogue or the line states it (`metadata.entitlement`). */
export type IOrderLineEntitlementPolicy = Record<string, unknown>;

/** One line, as the order states it to the policy port. */
export interface IOrderLineEntitlementQueryLine {
	readonly orderLineId: ID;
	readonly productId?: ID | null;
	readonly variantId?: ID | null;
	readonly quantity: number;
	/** The policy the line already carries — copied from its cart line, or stated by staff. */
	readonly stated?: IOrderLineEntitlementPolicy | null;
}

/** What an order asks the policy port. */
export interface IOrderLineEntitlementQuery {
	/** The order's own tenant and organization. */
	readonly tenantId?: ID | null;
	readonly organizationId?: ID | null;
	readonly lines: readonly IOrderLineEntitlementQueryLine[];
}

/** The entitlement capability, as the order consumes it. */
export interface IOrderLineEntitlementPolicyPort {
	/**
	 * @param query The order's scope and lines.
	 * @returns `null` when the capability is off for the order's scope (the order then announces no lines);
	 * otherwise, per order line id, the policy the line grants, or `null` when it grants nothing.
	 */
	policiesFor(query: IOrderLineEntitlementQuery): Promise<Record<string, IOrderLineEntitlementPolicy | null> | null>;
}

/** One line of an `order.placed` event. */
export interface IOrderPlacedLine {
	orderLineId: ID;
	productId: ID | null;
	variantId: ID | null;
	quantity: number;
	entitlement?: IOrderLineEntitlementPolicy;
}

/** What `order.placed` gains when the entitlement capability answers for the order. */
export interface IOrderPlacedLines {
	lines: IOrderPlacedLine[];
	/** How many lines the order has. */
	linesTotal: number;
	/** True when lines that grant nothing were left out to respect the cap. */
	linesTruncated: boolean;
}

/** The line shape the projection reads. */
export interface IOrderPlacedLineSource {
	id: ID;
	productId?: ID | null;
	variantId?: ID | null;
	quantity?: number | string | null;
}

/**
 * Projects an order's lines into the `lines` member of its `order.placed` event.
 *
 * Every line that grants a right is carried; the lines that grant nothing fill what is left of the cap, in
 * the order's own line order.
 *
 * @param lines The order's lines.
 * @param policies Per order line id, the policy it grants.
 * @param cap The most lines carried.
 * @returns The projection.
 */
export function placedLinesOf(
	lines: readonly IOrderPlacedLineSource[],
	policies: Record<string, IOrderLineEntitlementPolicy | null | undefined>,
	cap: number = ORDER_PLACED_LINES_CAP
): IOrderPlacedLines {
	const granting = lines.filter((line) => !!policies[line.id]).length;
	let room = Math.max(0, cap - granting);
	const projected: IOrderPlacedLine[] = [];

	for (const line of lines) {
		const entitlement = policies[line.id] ?? undefined;

		if (!entitlement) {
			if (room <= 0) {
				continue;
			}

			room--;
		}

		projected.push({
			orderLineId: line.id,
			productId: line.productId ?? null,
			variantId: line.variantId ?? null,
			quantity: Number(line.quantity ?? 1),
			...(entitlement ? { entitlement } : {})
		});
	}

	return { lines: projected, linesTotal: lines.length, linesTruncated: projected.length < lines.length };
}

/**
 * @param metadata A line's metadata.
 * @returns The policy it states (`metadata.entitlement`), when that is an object.
 */
export function statedEntitlementOf(metadata: unknown): IOrderLineEntitlementPolicy | null {
	const policy = (metadata as Record<string, unknown> | null | undefined)?.entitlement;

	return policy && typeof policy === 'object' && !Array.isArray(policy) ? (policy as IOrderLineEntitlementPolicy) : null;
}
