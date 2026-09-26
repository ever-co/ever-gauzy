import {
	ID,
	IRuleCreateInput,
	RuleEvaluationContext,
	RuleOperator,
	RuleOwnerType,
	RuleScope,
	RuleValueType
} from '@gauzy/contracts';
import { Entitlement } from './entitlement/entitlement.entity';
import { EntitlementKind, EntitlementStatus } from './entitlement.enums';
import { IEntitlementState } from './entitlement-check/entitlement-rules';
import { EntitlementConditionDTO } from './entitlement/dto/entitlement.dto';

/**
 * The entitlement domain's use of the platform rule engine.
 *
 * The specification is explicit that this domain introduces no fifth enum and no conditions table:
 * the *subject* of an entitlement is a foreign key and the *conditions* attached to it are `rule`
 * rows. That is not a shortcut, it is the platform's answer to conditionality — the same evaluator,
 * the same operator vocabulary and the same "an unresolved attribute does not match" rule that a
 * price list, a promotion and a tax rate are written against, so nobody has to learn a second
 * dialect to restrict a licence.
 */

/**
 * The rule owner type this domain registers.
 *
 * Read through this constant rather than written as a literal at each use site, so the rows this
 * package writes and the rows it reads can never disagree. The value is cast because the platform's
 * owner-type enumeration is extended by contributing packages; the string is the same in both
 * places.
 */
export const ENTITLEMENT_RULE_OWNER: RuleOwnerType = 'ENTITLEMENT' as unknown as RuleOwnerType;

/**
 * Builds the object a right's conditions are evaluated against.
 *
 * The context carries the right first, because that is what a condition is about — its kind, its
 * state and the identifiers it was granted against — and merges whatever the caller supplied over
 * it, so a request may add `context.region` or `customer.tier` without being able to overwrite what
 * the right itself says.
 *
 * @param entitlement The right being evaluated.
 * @param extra Attributes the caller supplied, merged over the derived context.
 * @returns The evaluation context.
 */
export function buildEntitlementContext(
	entitlement: IEntitlementState & Partial<Entitlement>,
	extra: Record<string, unknown> = {}
): RuleEvaluationContext {
	const endsAt = entitlement.endsAt ? new Date(entitlement.endsAt) : null;

	return {
		entitlement: {
			id: entitlement.id,
			number: entitlement.number,
			kind: entitlement.kind ?? EntitlementKind.LICENCE,
			status: entitlement.status ?? EntitlementStatus.PENDING,
			quantity: Number(entitlement.quantity ?? 0),
			activationCount: Number(entitlement.activationCount ?? 0),
			activationLimit: entitlement.activationLimit ?? null,
			startsAt: entitlement.startsAt ? new Date(entitlement.startsAt) : null,
			endsAt,
			// A perpetual right is one whose end date is absent; the flag is derived here so a rule may
			// read either spelling of the same fact, and neither is a stored second source of truth.
			isPerpetual: endsAt === null,
			customerId: entitlement.customerId ?? null,
			orderId: entitlement.orderId ?? null,
			orderLineId: entitlement.orderLineId ?? null,
			subscriptionId: entitlement.subscriptionId ?? null,
			productId: entitlement.productId ?? null,
			variantId: entitlement.variantId ?? null,
			metadata: (entitlement.metadata as Record<string, unknown>) ?? {}
		},
		...extra
	};
}

/**
 * Converts the conditions a caller stated into the rule rows that store them.
 *
 * The owner is filled in from the entitlement, because a condition belongs to the right it was
 * written on and a body must not be able to attach one to somebody else's row.
 *
 * @param entitlementId The right the conditions belong to.
 * @param conditions The conditions as the request stated them.
 * @returns The rule inputs, ready for the rule service to replace the set with.
 */
export function toRuleInputs(
	entitlementId: ID,
	conditions: readonly EntitlementConditionDTO[] = []
): IRuleCreateInput[] {
	return conditions.map((condition, index) => ({
		ownerType: ENTITLEMENT_RULE_OWNER,
		ownerId: entitlementId,
		scope: RuleScope.CONTEXT,
		attribute: condition.attribute,
		operator: condition.operator as unknown as RuleOperator,
		value: condition.value as IRuleCreateInput['value'],
		valueType: (condition.valueType as unknown as RuleValueType) ?? RuleValueType.STRING,
		isNegated: condition.isNegated ?? false,
		groupIndex: condition.groupIndex ?? 0,
		priority: condition.priority ?? index,
		description: condition.description
	}));
}
