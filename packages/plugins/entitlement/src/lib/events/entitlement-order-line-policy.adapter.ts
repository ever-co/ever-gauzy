import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { FeatureService } from '@gauzy/core';
import { EntitlementKind } from '../entitlement.enums';
import { EntitlementFeatures } from '../entitlement.features';
import { ENTITLEMENT_CATALOG_PORT, IEntitlementCatalogPort } from '../entitlement.types';

/** A right a line grants, as the order states it and as `order.placed` carries it. */
export type IEntitlementLinePolicy = Record<string, unknown>;

/** One order line, as the order states it to this adapter. */
export interface IEntitlementPolicyLine {
	readonly orderLineId: ID;
	readonly productId?: ID | null;
	readonly variantId?: ID | null;
	readonly quantity: number;
	/** The policy the line already carries (`metadata.entitlement`). */
	readonly stated?: IEntitlementLinePolicy | null;
}

/** What the order asks: its own scope and its lines. */
export interface IEntitlementPolicyQuery {
	readonly tenantId?: ID | null;
	readonly organizationId?: ID | null;
	readonly lines: readonly IEntitlementPolicyLine[];
}

/** The members a policy may state; anything else is dropped before the event carries it. */
const POLICY_MEMBERS = ['kind', 'quantity', 'startsAt', 'endsAt', 'gracePeriodDays', 'activationLimit', 'metadata'];

/**
 * What right an order line grants, answered for the order at placement (Q7-W5).
 *
 * Bound by the installation's composition module to the order package's `ORDER_LINE_ENTITLEMENT_POLICY`
 * port, so neither package imports the other. The answer is:
 *
 * - `null` when `FEATURE_ENTITLEMENT` is off for the order's scope — the order then announces no lines and
 *   nothing is granted, so a tenant that does not sell rights gets no rows;
 * - per line, the line's own `metadata.entitlement` (copied from its cart line at checkout), else the
 *   variant's, else the product's — read through the catalogue port this package already declares;
 * - a policy is checked before it travels: an unknown `kind`, a non-positive `quantity`, a negative grace or
 *   limit, or a term that cannot be read makes the line grant nothing (reported), because a right granted on
 *   a guess is worse than a line an operator re-grants by hand. Unknown members are dropped.
 *
 * The flag is read through the platform's `FeatureService`, which answers for the request in context; on a
 * placement with no request behind it the answer is the flag's default (off), and the order announces no
 * lines (recorded in the Q7-W5 handover row).
 */
@Injectable()
export class EntitlementOrderLinePolicyAdapter {
	private readonly logger = new Logger(EntitlementOrderLinePolicyAdapter.name);

	constructor(
		private readonly featureService: FeatureService,
		@Optional()
		@Inject(ENTITLEMENT_CATALOG_PORT)
		private readonly catalog?: IEntitlementCatalogPort
	) {}

	/**
	 * @param query The order's scope and lines.
	 * @returns `null` when the capability is off; otherwise, per order line id, the policy or `null`.
	 */
	async policiesFor(query: IEntitlementPolicyQuery): Promise<Record<string, IEntitlementLinePolicy | null> | null> {
		if (!(await this.featureService.isFeatureEnabled(EntitlementFeatures.ENTITLEMENT))) {
			return null;
		}

		const variants = new Map<ID, IEntitlementLinePolicy | null>();
		const products = new Map<ID, IEntitlementLinePolicy | null>();
		const answer: Record<string, IEntitlementLinePolicy | null> = {};

		for (const line of query.lines) {
			let stated = policyObjectOf(line.stated);

			if (!stated && line.variantId) {
				stated = await this.catalogPolicy(variants, line.variantId, (id) => this.catalog?.findVariant(id));
			}

			if (!stated && line.productId) {
				stated = await this.catalogPolicy(products, line.productId, (id) => this.catalog?.findProduct(id));
			}

			answer[line.orderLineId] = stated ? this.checked(stated, line.orderLineId) : null;
		}

		return answer;
	}

	/**
	 * @param cache What this call already read.
	 * @param id The variant or product.
	 * @param read The catalogue read.
	 * @returns The policy its `metadata.entitlement` states, or null.
	 */
	private async catalogPolicy(
		cache: Map<ID, IEntitlementLinePolicy | null>,
		id: ID,
		read: (id: ID) => Promise<{ metadata?: unknown } | null> | undefined
	): Promise<IEntitlementLinePolicy | null> {
		if (!cache.has(id)) {
			const item = await read(id);

			cache.set(id, policyObjectOf((item?.metadata as Record<string, unknown> | null | undefined)?.entitlement));
		}

		return cache.get(id) ?? null;
	}

	/**
	 * @param policy The stated policy.
	 * @param orderLineId The line, for the report.
	 * @returns The policy with its known members only, or null when one of them is not usable.
	 */
	private checked(policy: IEntitlementLinePolicy, orderLineId: ID): IEntitlementLinePolicy | null {
		const problem = policyProblemOf(policy);

		if (problem) {
			this.logger.warn(`ENTITLEMENT_POLICY_INVALID: order line ${orderLineId} grants nothing: ${problem}.`);
			return null;
		}

		return Object.fromEntries(
			Object.entries(policy).filter(([member, value]) => POLICY_MEMBERS.includes(member) && value !== undefined)
		);
	}
}

/**
 * @param value A stated policy.
 * @returns It, when it is a plain object.
 */
function policyObjectOf(value: unknown): IEntitlementLinePolicy | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as IEntitlementLinePolicy) : null;
}

/**
 * @param policy A stated policy.
 * @returns What makes it unusable, or null.
 */
export function policyProblemOf(policy: IEntitlementLinePolicy): string | null {
	const { kind, quantity, startsAt, endsAt, gracePeriodDays, activationLimit, metadata } = policy as Record<
		string,
		any
	>;

	if (kind !== undefined && !Object.values(EntitlementKind).includes(kind)) {
		return `kind "${kind}" is not one of ${Object.values(EntitlementKind).join(', ')}`;
	}

	if (quantity !== undefined && !(Number.isInteger(Number(quantity)) && Number(quantity) > 0)) {
		return 'quantity must be a positive whole number';
	}

	for (const [member, value] of [
		['gracePeriodDays', gracePeriodDays],
		['activationLimit', activationLimit]
	] as const) {
		if (value !== undefined && value !== null && !(Number.isInteger(Number(value)) && Number(value) >= 0)) {
			return `${member} must be a whole number of at least 0`;
		}
	}

	for (const [member, value] of [
		['startsAt', startsAt],
		['endsAt', endsAt]
	] as const) {
		if (value !== undefined && value !== null && Number.isNaN(new Date(value).getTime())) {
			return `${member} is not a date`;
		}
	}

	if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
		return 'endsAt must be later than startsAt';
	}

	if (metadata !== undefined && metadata !== null && (typeof metadata !== 'object' || Array.isArray(metadata))) {
		return 'metadata must be an object';
	}

	return null;
}
