import { IRule, RuleOperator, RuleOwnerType, RuleScope, RuleValueType } from '@gauzy/contracts';
import {
	RULE_MAX_GROUPS,
	RULE_MAX_PATTERN_LENGTH,
	RULE_MAX_RULES_PER_GROUP,
	RuleValidationCode,
	isOperatorAllowedForType,
	isSafePattern,
	isScopeAllowedForOwnerType,
	validateRuleDefinition,
	validateRuleSet
} from './rule.validator';

/**
 * What is checked when a rule is written.
 *
 * The evaluator has to be able to trust the shape of a rule row, because a rule that cannot be
 * evaluated the way its author meant surfaces as a promotion that "sometimes" fires. Each case here
 * is a mistake an administrator can genuinely make, asserted through the public entry point: the
 * codes a caller branches on, and — as importantly — that a rule which is fine is not refused.
 */

const rule = (overrides: Partial<IRule> = {}): IRule => ({
	ownerType: RuleOwnerType.PROMOTION,
	ownerId: '2f9c4a17-6b03-4d8e-9a51-3c7e0b1d2f48',
	scope: RuleScope.ORDER,
	attribute: 'customer.groups.code',
	operator: RuleOperator.EQ,
	value: 'WHOLESALE',
	valueType: RuleValueType.STRING,
	isNegated: false,
	groupIndex: 0,
	priority: 0,
	...overrides
});

/** The codes a validation call reports, so a case can assert on the set rather than on messages. */
const codesOf = (subject: Partial<IRule>): RuleValidationCode[] =>
	validateRuleDefinition(subject).map((problem) => problem.code);

describe('the operator and scope tables', () => {
	it('refuses an operator a value type cannot express', () => {
		// Ordering a string would make the platform guess at a collation, so the guess is refused here
		// rather than being made at runtime.
		expect(isOperatorAllowedForType(RuleOperator.GT, RuleValueType.STRING)).toBe(false);
		expect(isOperatorAllowedForType(RuleOperator.CONTAINS, RuleValueType.BOOLEAN)).toBe(false);
		expect(isOperatorAllowedForType(RuleOperator.MATCHES, RuleValueType.NUMBER)).toBe(false);
		expect(isOperatorAllowedForType(RuleOperator.GT, RuleValueType.DECIMAL)).toBe(true);
		expect(isOperatorAllowedForType(RuleOperator.MATCHES, RuleValueType.STRING)).toBe(true);
		expect(isOperatorAllowedForType(RuleOperator.IS_NULL, RuleValueType.BOOLEAN)).toBe(true);
	});

	it('refuses a scope whose context the owner is never evaluated in', () => {
		// A promotion action is evaluated per candidate item; it has no document-level context to read.
		expect(isScopeAllowedForOwnerType(RuleOwnerType.PROMOTION_ACTION, RuleScope.ORDER)).toBe(false);
		expect(isScopeAllowedForOwnerType(RuleOwnerType.PROMOTION_ACTION, RuleScope.BUY)).toBe(true);
		expect(isScopeAllowedForOwnerType(RuleOwnerType.PROMOTION, RuleScope.ORDER)).toBe(true);
		expect(isScopeAllowedForOwnerType('UNKNOWN' as RuleOwnerType, RuleScope.ORDER)).toBe(false);
	});

	it('accepts a pattern that is a full match, and refuses one whose cost depends on its input', () => {
		expect(isSafePattern('[A-Z]{2}[0-9]{4}')).toBe(true);
		expect(isSafePattern('(a)\\1')).toBe(false);
		expect(isSafePattern('(a+)+$')).toBe(false);
		expect(isSafePattern('a'.repeat(RULE_MAX_PATTERN_LENGTH + 1))).toBe(false);
		expect(isSafePattern('')).toBe(false);
		expect(isSafePattern('(')).toBe(false);
	});

	it('states the caps the platform publishes', () => {
		expect(RULE_MAX_GROUPS).toBe(20);
		expect(RULE_MAX_RULES_PER_GROUP).toBe(50);
		expect(RULE_MAX_PATTERN_LENGTH).toBe(256);
	});
});

describe('validateRuleDefinition', () => {
	it('accepts a rule that can be evaluated as written', () => {
		// The control for every refusal below: without it a validator that refused everything would
		// pass this suite.
		expect(validateRuleDefinition(rule())).toEqual([]);
		expect(validateRuleDefinition(rule({ operator: RuleOperator.IN, value: ['A', 'B'] }))).toEqual([]);
		expect(validateRuleDefinition(rule({ operator: RuleOperator.IS_NULL, value: null }))).toEqual([]);
		expect(validateRuleDefinition(rule({ operator: RuleOperator.BETWEEN, value: ['6', '11'], valueType: RuleValueType.NUMBER }))).toEqual([]);
	});

	it('requires the owner the evaluator would load the rule by', () => {
		expect(codesOf(rule({ ownerType: undefined }))).toEqual([RuleValidationCode.RULE_OWNER_REQUIRED]);
		expect(codesOf(rule({ ownerId: undefined }))).toEqual([RuleValidationCode.RULE_OWNER_REQUIRED]);
	});

	it('names the attribute and the operator a rule is missing', () => {
		expect(codesOf(rule({ attribute: '' }))).toEqual([RuleValidationCode.RULE_DEFINITION_INCOMPLETE]);
		expect(codesOf(rule({ operator: undefined }))).toEqual([RuleValidationCode.RULE_DEFINITION_INCOMPLETE]);
	});

	it('refuses a scope the owner type may not use', () => {
		expect(codesOf(rule({ ownerType: RuleOwnerType.PROMOTION_ACTION, scope: RuleScope.ORDER }))).toEqual([
			RuleValidationCode.RULE_SCOPE_NOT_ALLOWED
		]);
	});

	it('refuses a per-item rule that reads the document context', () => {
		// The rule is evaluated once per candidate item, so `order.total` is not a question the
		// context it runs against can answer.
		expect(codesOf(rule({ ownerType: RuleOwnerType.PROMOTION_ACTION, scope: RuleScope.BUY, attribute: 'order.total' }))).toEqual([
			RuleValidationCode.RULE_ORDER_PATH_IN_CART_SCOPE
		]);
		expect(codesOf(rule({ ownerType: RuleOwnerType.PROMOTION_ACTION, scope: RuleScope.TARGET, attribute: 'commerce_cart.status' }))).toEqual([
			RuleValidationCode.RULE_ORDER_PATH_IN_CART_SCOPE
		]);
	});

	it('refuses an operator the declared value type cannot express', () => {
		expect(codesOf(rule({ operator: RuleOperator.GT, value: 'A', valueType: RuleValueType.STRING }))).toEqual([
			RuleValidationCode.RULE_OPERATOR_NOT_ALLOWED_FOR_TYPE
		]);
	});

	it('refuses an IN whose operand is not a non-empty list', () => {
		// Control: the evaluator would silently read a scalar as a one-element set, so a validator that
		// only checked for presence would let a mistake through to a rule that matches by accident.
		expect(codesOf(rule({ operator: RuleOperator.IN, value: 'A' }))).toEqual([RuleValidationCode.RULE_VALUE_NOT_ARRAY]);
		expect(codesOf(rule({ operator: RuleOperator.NOT_IN, value: [] }))).toEqual([RuleValidationCode.RULE_VALUE_NOT_ARRAY]);
		expect(codesOf(rule({ operator: RuleOperator.IN, value: ['A'] }))).toEqual([]);
	});

	it('refuses a BETWEEN that is not two ordered bounds', () => {
		expect(codesOf(rule({ operator: RuleOperator.BETWEEN, value: [1, 2, 3], valueType: RuleValueType.NUMBER }))).toEqual([
			RuleValidationCode.RULE_BETWEEN_INVALID
		]);
		expect(codesOf(rule({ operator: RuleOperator.BETWEEN, value: [11, 6], valueType: RuleValueType.NUMBER }))).toEqual([
			RuleValidationCode.RULE_BETWEEN_INVALID
		]);
		expect(
			codesOf(rule({ operator: RuleOperator.BETWEEN, value: ['abc', 'def'], valueType: RuleValueType.DECIMAL }))
		).toEqual([RuleValidationCode.RULE_VALUE_TYPE_MISMATCH]);
	});

	it('leaves a date range to the evaluator, which is the layer that can read a date', () => {
		// The bounds are only ordered here when both are exact decimals; a date pair is compared by the
		// evaluator instead, so the pair is accepted as written rather than guessed at.
		expect(
			codesOf(rule({ operator: RuleOperator.BETWEEN, value: ['2026-03-31', '2026-01-01'], valueType: RuleValueType.DATE }))
		).toEqual([]);
	});

	it('refuses an IS_NULL that carries a value', () => {
		expect(codesOf(rule({ operator: RuleOperator.IS_NULL, value: 'A' }))).toEqual([RuleValidationCode.RULE_VALUE_NOT_ALLOWED]);
		expect(codesOf(rule({ operator: RuleOperator.IS_NULL, value: null }))).toEqual([]);
	});

	it('refuses a MATCHES pattern that is unusable or can backtrack', () => {
		expect(codesOf(rule({ operator: RuleOperator.MATCHES, value: '(a+)+$' }))).toEqual([RuleValidationCode.RULE_REGEX_UNSAFE]);
		expect(codesOf(rule({ operator: RuleOperator.MATCHES, value: '(' }))).toEqual([RuleValidationCode.RULE_REGEX_UNSAFE]);
		expect(codesOf(rule({ operator: RuleOperator.MATCHES, value: 'a'.repeat(RULE_MAX_PATTERN_LENGTH + 1) }))).toEqual([
			RuleValidationCode.RULE_REGEX_UNSAFE
		]);
		expect(codesOf(rule({ operator: RuleOperator.MATCHES, value: '[A-Z]{2}[0-9]{4}' }))).toEqual([]);
	});

	it('refuses a decimal operand that is not an exact decimal', () => {
		expect(codesOf(rule({ operator: RuleOperator.EQ, value: 'abc', valueType: RuleValueType.DECIMAL }))).toEqual([
			RuleValidationCode.RULE_VALUE_TYPE_MISMATCH
		]);
		expect(codesOf(rule({ operator: RuleOperator.EQ, value: Number.NaN, valueType: RuleValueType.DECIMAL }))).toEqual([
			RuleValidationCode.RULE_VALUE_TYPE_MISMATCH
		]);
		expect(codesOf(rule({ operator: RuleOperator.EQ, value: '100.000000', valueType: RuleValueType.DECIMAL }))).toEqual([]);
	});

	it('reports every problem it finds rather than stopping at the first', () => {
		const problems = validateRuleDefinition({ operator: RuleOperator.IN, value: 'A' });

		expect(problems.map((problem) => problem.code)).toEqual([
			RuleValidationCode.RULE_OWNER_REQUIRED,
			RuleValidationCode.RULE_DEFINITION_INCOMPLETE,
			RuleValidationCode.RULE_VALUE_NOT_ARRAY
		]);
		expect(problems.every((problem) => problem.message.length > 0)).toBe(true);
	});
});

describe('validateRuleSet', () => {
	const atTheCap = (count: number, groupIndex: number) =>
		Array.from({ length: count }, (_unused, index) =>
			rule({ groupIndex, attribute: `a${index}`, operator: RuleOperator.IS_NULL, value: null })
		);

	it('accepts a set inside the caps', () => {
		expect(validateRuleSet(atTheCap(RULE_MAX_RULES_PER_GROUP, 0))).toEqual([]);
		expect(validateRuleSet(Array.from({ length: RULE_MAX_GROUPS }, (_unused, index) => rule({ groupIndex: index })))).toEqual([]);
	});

	it('refuses a set with more groups than the platform evaluates', () => {
		const problems = validateRuleSet(
			Array.from({ length: RULE_MAX_GROUPS + 1 }, (_unused, index) => rule({ groupIndex: index }))
		);

		expect(problems.map((problem) => problem.code)).toContain(RuleValidationCode.RULE_SET_TOO_COMPLEX);
	});

	it('refuses a group with more rules than the platform evaluates', () => {
		const problems = validateRuleSet(atTheCap(RULE_MAX_RULES_PER_GROUP + 1, 3));

		expect(problems.map((problem) => problem.code)).toContain(RuleValidationCode.RULE_SET_TOO_COMPLEX);
		expect(problems.map((problem) => problem.message).join(' ')).toContain('Group 3');
	});

	it('reports the problems of the rules it is given, not only the caps', () => {
		const problems = validateRuleSet([rule(), rule({ attribute: '', value: 'A' })]);

		expect(problems.map((problem) => problem.code)).toEqual([RuleValidationCode.RULE_DEFINITION_INCOMPLETE]);
	});
});
