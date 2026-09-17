import { IRule, RuleOperator, RuleOwnerType, RuleScope, RuleValueType } from '@gauzy/contracts';
import { compareDecimalStrings, isValidDecimalString } from '../money/decimal';

/**
 * What is checked when a rule is written.
 *
 * A rule set is data an administrator authors, and the evaluator has to be able to trust its shape:
 * an `IN` whose operand is a scalar, a `BETWEEN` whose bounds are reversed or a `MATCHES` whose
 * pattern backtracks catastrophically are all mistakes that would otherwise surface as a promotion
 * that "sometimes" fires, or as a pricing run that never returns. Every check reports a code the
 * caller can act on rather than throwing from four frames deep.
 *
 * The checks here are the ones that need no database read. Ownership — that `ownerId` belongs to the
 * same organization and tenant — is checked by the service, which is the layer that can read the
 * owning row.
 */

/** The maximum number of distinct OR groups a rule set may declare. */
export const RULE_MAX_GROUPS = 20;

/** The maximum number of rules one group may hold. */
export const RULE_MAX_RULES_PER_GROUP = 50;

/** The maximum length of a `MATCHES` pattern. */
export const RULE_MAX_PATTERN_LENGTH = 256;

/**
 * The codes a validation problem is reported with.
 */
export enum RuleValidationCode {
	/** The attribute is empty, or the rule declares no operator. */
	RULE_DEFINITION_INCOMPLETE = 'RULE_DEFINITION_INCOMPLETE',
	/** The rule declares no owner. */
	RULE_OWNER_REQUIRED = 'RULE_OWNER_REQUIRED',
	/** The scope is not one the owner type may use. */
	RULE_SCOPE_NOT_ALLOWED = 'RULE_SCOPE_NOT_ALLOWED',
	/** The operator is not one the value type supports. */
	RULE_OPERATOR_NOT_ALLOWED_FOR_TYPE = 'RULE_OPERATOR_NOT_ALLOWED_FOR_TYPE',
	/** `IN` and `NOT_IN` need a non-empty array operand. */
	RULE_VALUE_NOT_ARRAY = 'RULE_VALUE_NOT_ARRAY',
	/** `BETWEEN` needs exactly two ordered bounds. */
	RULE_BETWEEN_INVALID = 'RULE_BETWEEN_INVALID',
	/** `IS_NULL` takes no operand. */
	RULE_VALUE_NOT_ALLOWED = 'RULE_VALUE_NOT_ALLOWED',
	/** The pattern does not compile, is too long, or can backtrack catastrophically. */
	RULE_REGEX_UNSAFE = 'RULE_REGEX_UNSAFE',
	/** An operand of an ordering operator is not an exact decimal or a date. */
	RULE_VALUE_TYPE_MISMATCH = 'RULE_VALUE_TYPE_MISMATCH',
	/** A `BUY` or `TARGET` rule references the document-level context. */
	RULE_ORDER_PATH_IN_CART_SCOPE = 'RULE_ORDER_PATH_IN_CART_SCOPE',
	/** The rule set exceeds the group or per-group caps. */
	RULE_SET_TOO_COMPLEX = 'RULE_SET_TOO_COMPLEX'
}

/**
 * One reason a rule cannot be written.
 */
export interface IRuleValidationProblem {
	/** The code to report. */
	code: RuleValidationCode;

	/** A message naming the offending field. */
	message: string;
}

/**
 * The scopes each owner type may declare.
 *
 * A promotion cannot be conditioned on the approval request it is not part of, and an approval policy
 * cannot be conditioned on a shipping method: the context that would answer the question is not the
 * one the owner is evaluated in. Stating the legal pairs here is what keeps a rule from being authored
 * that the evaluator can never satisfy.
 */
const ALLOWED_SCOPES: Record<RuleOwnerType, readonly RuleScope[]> = {
	[RuleOwnerType.COLLECTION]: [RuleScope.ORDER, RuleScope.ITEM, RuleScope.CUSTOMER, RuleScope.CONTEXT],
	[RuleOwnerType.PRICE_LIST]: [RuleScope.CONTEXT, RuleScope.CUSTOMER, RuleScope.ITEM],
	[RuleOwnerType.PRICE]: [RuleScope.CONTEXT, RuleScope.ITEM],
	[RuleOwnerType.PROMOTION]: [RuleScope.ORDER, RuleScope.ITEM, RuleScope.SHIPPING, RuleScope.CUSTOMER],
	[RuleOwnerType.PROMOTION_ACTION]: [RuleScope.BUY, RuleScope.TARGET],
	[RuleOwnerType.SHIPPING_OPTION]: [RuleScope.ORDER, RuleScope.ITEM],
	[RuleOwnerType.TAX_RATE]: [RuleScope.ITEM, RuleScope.SHIPPING, RuleScope.CUSTOMER],
	[RuleOwnerType.CUSTOMER_SEGMENT]: [RuleScope.CUSTOMER, RuleScope.ORDER, RuleScope.ITEM, RuleScope.CONTEXT],
	[RuleOwnerType.PAYMENT_PROVIDER]: [RuleScope.ORDER, RuleScope.CUSTOMER],
	[RuleOwnerType.FULFILLMENT_OPTION]: [RuleScope.ORDER, RuleScope.ITEM],
	[RuleOwnerType.STOCK_ALLOCATION]: [RuleScope.ORDER, RuleScope.ITEM],
	[RuleOwnerType.APPROVAL_POLICY]: [
		RuleScope.REQUEST,
		RuleScope.ORDER,
		RuleScope.ITEM,
		RuleScope.CUSTOMER,
		RuleScope.CONTEXT
	],
	[RuleOwnerType.WAREHOUSE_BIN]: [RuleScope.ITEM, RuleScope.ORDER, RuleScope.CONTEXT],
	[RuleOwnerType.SELLER]: [RuleScope.CONTEXT, RuleScope.ITEM, RuleScope.ORDER]
};

/**
 * The operators each value type supports.
 *
 * `GT` on a string attribute is not "unusual", it is meaningless — the platform would have to guess at
 * a collation — so it is rejected when the rule is written rather than left to produce a surprising
 * verdict at runtime.
 */
const ALLOWED_OPERATORS: Record<RuleValueType, readonly RuleOperator[]> = {
	[RuleValueType.STRING]: [
		RuleOperator.EQ,
		RuleOperator.NEQ,
		RuleOperator.IN,
		RuleOperator.NOT_IN,
		RuleOperator.CONTAINS,
		RuleOperator.STARTS_WITH,
		RuleOperator.ENDS_WITH,
		RuleOperator.MATCHES,
		RuleOperator.IS_NULL
	],
	[RuleValueType.ENUM]: [
		RuleOperator.EQ,
		RuleOperator.NEQ,
		RuleOperator.IN,
		RuleOperator.NOT_IN,
		RuleOperator.IS_NULL
	],
	[RuleValueType.NUMBER]: [
		RuleOperator.EQ,
		RuleOperator.NEQ,
		RuleOperator.IN,
		RuleOperator.NOT_IN,
		RuleOperator.GT,
		RuleOperator.GTE,
		RuleOperator.LT,
		RuleOperator.LTE,
		RuleOperator.BETWEEN,
		RuleOperator.IS_NULL
	],
	[RuleValueType.DECIMAL]: [
		RuleOperator.EQ,
		RuleOperator.NEQ,
		RuleOperator.IN,
		RuleOperator.NOT_IN,
		RuleOperator.GT,
		RuleOperator.GTE,
		RuleOperator.LT,
		RuleOperator.LTE,
		RuleOperator.BETWEEN,
		RuleOperator.IS_NULL
	],
	[RuleValueType.DATE]: [
		RuleOperator.EQ,
		RuleOperator.NEQ,
		RuleOperator.IN,
		RuleOperator.NOT_IN,
		RuleOperator.GT,
		RuleOperator.GTE,
		RuleOperator.LT,
		RuleOperator.LTE,
		RuleOperator.BETWEEN,
		RuleOperator.IS_NULL
	],
	[RuleValueType.BOOLEAN]: [
		RuleOperator.EQ,
		RuleOperator.NEQ,
		RuleOperator.IN,
		RuleOperator.NOT_IN,
		RuleOperator.IS_NULL
	]
};

/**
 * @param ownerType The owner type.
 * @param scope The scope.
 * @returns True when the owner type may declare the scope.
 */
export function isScopeAllowedForOwnerType(ownerType: RuleOwnerType, scope: RuleScope): boolean {
	return (ALLOWED_SCOPES[ownerType] ?? []).includes(scope);
}

/**
 * @param operator The operator.
 * @param valueType The value type.
 * @returns True when the value type supports the operator.
 */
export function isOperatorAllowedForType(operator: RuleOperator, valueType: RuleValueType): boolean {
	return (ALLOWED_OPERATORS[valueType] ?? []).includes(operator);
}

/**
 * @param pattern The pattern to inspect.
 * @returns True when the pattern is a full-match expression that cannot backtrack catastrophically.
 */
export function isSafePattern(pattern: string): boolean {
	if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > RULE_MAX_PATTERN_LENGTH) {
		return false;
	}

	// A backreference makes a pattern's cost depend on the input it is matched against, which is the
	// first half of a denial-of-service pattern; a quantifier applied to a group that is itself
	// quantified is the second.
	if (/\\[1-9]/.test(pattern) || /\([^)]*[+*][^)]*\)\s*[+*]/.test(pattern)) {
		return false;
	}

	try {
		new RegExp(`^(?:${pattern})$`);
		return true;
	} catch {
		return false;
	}
}

/**
 * Checks one rule.
 *
 * @param rule The rule to check.
 * @returns Every problem found, empty when the rule is writable.
 */
export function validateRuleDefinition(
	rule: Partial<Pick<IRule, 'ownerType' | 'ownerId' | 'scope' | 'attribute' | 'operator' | 'value' | 'valueType'>>
): IRuleValidationProblem[] {
	const problems: IRuleValidationProblem[] = [];
	const valueType = rule.valueType ?? RuleValueType.STRING;
	const operator = rule.operator;

	if (!rule.ownerType || !rule.ownerId) {
		problems.push({
			code: RuleValidationCode.RULE_OWNER_REQUIRED,
			message: 'A rule must state the owner type and the owning row it belongs to.'
		});
	} else if (rule.scope && !isScopeAllowedForOwnerType(rule.ownerType, rule.scope)) {
		problems.push({
			code: RuleValidationCode.RULE_SCOPE_NOT_ALLOWED,
			message: `A ${rule.ownerType} rule cannot be evaluated in the ${rule.scope} scope.`
		});
	}

	if (!rule.attribute || typeof rule.attribute !== 'string') {
		problems.push({
			code: RuleValidationCode.RULE_DEFINITION_INCOMPLETE,
			message: 'A rule must name the attribute it reads.'
		});
	}

	if (!operator) {
		problems.push({
			code: RuleValidationCode.RULE_DEFINITION_INCOMPLETE,
			message: 'A rule must state the operator it applies.'
		});

		return problems;
	}

	if (!isOperatorAllowedForType(operator, valueType)) {
		problems.push({
			code: RuleValidationCode.RULE_OPERATOR_NOT_ALLOWED_FOR_TYPE,
			message: `The ${operator} operator cannot be applied to a ${valueType} attribute.`
		});
	}

	if ((rule.scope === RuleScope.BUY || rule.scope === RuleScope.TARGET) && typeof rule.attribute === 'string') {
		if (rule.attribute.startsWith('order.') || rule.attribute.startsWith('commerce_cart.')) {
			problems.push({
				code: RuleValidationCode.RULE_ORDER_PATH_IN_CART_SCOPE,
				message: `A ${rule.scope} rule is evaluated per candidate item and cannot read ${rule.attribute}.`
			});
		}
	}

	switch (operator) {
		case RuleOperator.IN:
		case RuleOperator.NOT_IN:
			if (!Array.isArray(rule.value) || rule.value.length === 0) {
				problems.push({
					code: RuleValidationCode.RULE_VALUE_NOT_ARRAY,
					message: `The ${operator} operator needs a non-empty array of values.`
				});
			}
			break;
		case RuleOperator.BETWEEN: {
			if (!Array.isArray(rule.value) || rule.value.length !== 2) {
				problems.push({
					code: RuleValidationCode.RULE_BETWEEN_INVALID,
					message: 'The BETWEEN operator needs exactly two bounds.'
				});
				break;
			}

			const [low, high] = rule.value;

			// The bounds are only ordered when both are exact decimals; a date pair is compared by the
			// evaluator, which is the layer that knows how to read a date.
			if (isDecimalOperand(low) && isDecimalOperand(high) && compareDecimalStrings(String(low), String(high)) > 0) {
				problems.push({
					code: RuleValidationCode.RULE_BETWEEN_INVALID,
					message: `The BETWEEN bounds are reversed: ${String(low)} is above ${String(high)}.`
				});
			}

			if ((valueType === RuleValueType.NUMBER || valueType === RuleValueType.DECIMAL) && (!isDecimalOperand(low) || !isDecimalOperand(high))) {
				problems.push({
					code: RuleValidationCode.RULE_VALUE_TYPE_MISMATCH,
					message: 'A numeric BETWEEN needs two exact decimal bounds.'
				});
			}
			break;
		}
		case RuleOperator.IS_NULL:
			if (rule.value !== null && rule.value !== undefined) {
				problems.push({
					code: RuleValidationCode.RULE_VALUE_NOT_ALLOWED,
					message: 'The IS_NULL operator takes no value.'
				});
			}
			break;
		case RuleOperator.MATCHES:
			if (typeof rule.value !== 'string' || !isSafePattern(rule.value)) {
				problems.push({
					code: RuleValidationCode.RULE_REGEX_UNSAFE,
					message: 'The MATCHES pattern must compile, be at most 256 characters, and not backtrack.'
				});
			}
			break;
		default:
			// A decimal operand has to arrive as an exact decimal string: a JSON number has already lost
			// whatever precision the author meant, and rounding it here would hide that.
			if (valueType === RuleValueType.DECIMAL && !Array.isArray(rule.value) && !isDecimalOperand(rule.value)) {
				problems.push({
					code: RuleValidationCode.RULE_VALUE_TYPE_MISMATCH,
					message: 'A DECIMAL operand must be an exact decimal value.'
				});
			}
			break;
	}

	return problems;
}

/**
 * Checks a whole rule set.
 *
 * @param rules The rules of one owner.
 * @returns Every problem found, empty when the set is writable.
 */
export function validateRuleSet(rules: readonly IRule[]): IRuleValidationProblem[] {
	const problems: IRuleValidationProblem[] = [];
	const groups = new Map<number, number>();

	for (const rule of rules) {
		problems.push(...validateRuleDefinition(rule));

		const groupIndex = Number.isFinite(rule?.groupIndex) ? rule.groupIndex : 0;
		groups.set(groupIndex, (groups.get(groupIndex) ?? 0) + 1);
	}

	if (groups.size > RULE_MAX_GROUPS) {
		problems.push({
			code: RuleValidationCode.RULE_SET_TOO_COMPLEX,
			message: `A rule set holds at most ${RULE_MAX_GROUPS} groups; this one declares ${groups.size}.`
		});
	}

	for (const [groupIndex, count] of groups) {
		if (count > RULE_MAX_RULES_PER_GROUP) {
			problems.push({
				code: RuleValidationCode.RULE_SET_TOO_COMPLEX,
				message: `Group ${groupIndex} holds at most ${RULE_MAX_RULES_PER_GROUP} rules; it declares ${count}.`
			});
		}
	}

	return problems;
}

/**
 * @param value The operand to test.
 * @returns True when the operand is an exact decimal.
 */
function isDecimalOperand(value: unknown): boolean {
	if (typeof value === 'number') {
		return Number.isFinite(value);
	}

	return isValidDecimalString(value);
}
