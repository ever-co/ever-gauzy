import {
	IRule,
	RuleEvaluationContext,
	RuleOperand,
	RuleOperator,
	RuleOwnerType,
	RuleScope,
	RuleValueType
} from '@gauzy/contracts';
import { evaluateRuleSet, matchesRule, resolveAttributePath, ruleSetMatches } from './rule.evaluator';

/**
 * The rule language, asserted as a language.
 *
 * A rule set is data an administrator authors and the evaluator runs on every cart write, so the
 * cases here are the decisions that decide whether a promotion fires: how a group combines, what an
 * attribute the context does not carry does, how a value that cannot be coerced is treated, and
 * which of several matching rules a verdict and its trace come from.
 *
 * The evaluator is pure — it reads no database and no request context — so every case is a rule set
 * and a context, with nothing else standing in for the platform.
 */

const rule = (overrides: Partial<IRule> = {}): IRule => ({
	ownerType: RuleOwnerType.PROMOTION,
	ownerId: 'owner-1',
	scope: RuleScope.ORDER,
	attribute: 'x',
	operator: RuleOperator.EQ,
	value: 'y',
	valueType: RuleValueType.STRING,
	isNegated: false,
	groupIndex: 0,
	priority: 0,
	...overrides
});

describe('resolveAttributePath', () => {
	it('walks an own-property path and reports a value that is present but null', () => {
		expect(resolveAttributePath({ customer: { groups: { code: 'WHOLESALE' } } }, 'customer.groups.code')).toEqual({
			resolved: true,
			value: 'WHOLESALE'
		});
		// A resolved null is information — the attribute is configured and empty — and is not the same
		// answer as an attribute the context does not carry at all.
		expect(resolveAttributePath({ a: null }, 'a')).toEqual({ resolved: true, value: null });
	});

	it('reports a missing path rather than throwing', () => {
		expect(resolveAttributePath({ customer: {} }, 'customer.groups')).toEqual({ resolved: false });
		expect(resolveAttributePath({ customer: null }, 'customer.groups.id')).toEqual({ resolved: false });
		expect(resolveAttributePath(undefined, 'a')).toEqual({ resolved: false });
		expect(resolveAttributePath({ a: 'text' }, 'a.b')).toEqual({ resolved: false });
		expect(resolveAttributePath({ a: 1 }, '')).toEqual({ resolved: false });
	});

	it('never reads the prototype chain, because a path is authored and a context is live', () => {
		// `constructor.name` resolving would hand an administrator a rule over something that is not
		// part of the context at all — the difference between a condition and an escape.
		expect(resolveAttributePath({}, 'constructor.name')).toEqual({ resolved: false });
		expect(resolveAttributePath({}, 'toString')).toEqual({ resolved: false });
		expect(resolveAttributePath({ customer: {} }, 'customer.constructor')).toEqual({ resolved: false });
	});
});

describe('matchesRule', () => {
	it('reads a condition against the context it is given', () => {
		expect(matchesRule(rule({ attribute: 'sku', value: 'WIDGET-A' }), { sku: 'WIDGET-A' })).toBe(true);
		expect(matchesRule(rule({ attribute: 'sku', value: 'WIDGET-A' }), { sku: 'WIDGET-B' })).toBe(false);
	});

	it('treats an unknown field as no match, and names it instead of answering silently', () => {
		// Control: the same rule against a context that does carry the path matches, so the assertion
		// below fails if the evaluator ever starts guessing a default for a field it cannot resolve.
		expect(matchesRule(rule({ attribute: 'customer.groups.code', value: 'WHOLESALE' }), {
			customer: { groups: { code: 'WHOLESALE' } }
		})).toBe(true);

		const trace = { unresolvedAttributes: [] as string[], coercionFailures: [] as string[] };

		expect(
			matchesRule(rule({ attribute: 'customer.groups.code', value: 'WHOLESALE' }), { customer: {} }, trace)
		).toBe(false);
		expect(trace.unresolvedAttributes).toEqual(['customer.groups.code']);
	});

	it('does not let a negation turn an unknown field into a match', () => {
		// The most dangerous corner of the language: `NOT` over an unconfigured attribute would make a
		// rule match everything, so the verdict is reached before the negation is applied.
		expect(matchesRule(rule({ attribute: 'customer.id', operator: RuleOperator.IS_NULL, value: null, isNegated: true }), {})).toBe(
			false
		);
		expect(matchesRule(rule({ attribute: 'code', value: 'A', isNegated: true }), { code: 'B' })).toBe(true);
		expect(matchesRule(rule({ attribute: 'code', value: 'A', isNegated: true }), {})).toBe(false);
	});

	it('coerces the attribute and the operand to the type the rule compares in', () => {
		expect(matchesRule(rule({ attribute: 'quantity', operator: RuleOperator.GTE, value: 6, valueType: RuleValueType.NUMBER }), { quantity: '6' })).toBe(true);
		expect(matchesRule(rule({ attribute: 'exempt', value: true, valueType: RuleValueType.BOOLEAN }), { exempt: 'true' })).toBe(true);
		expect(matchesRule(rule({ attribute: 'exempt', value: false, valueType: RuleValueType.BOOLEAN }), { exempt: 0 })).toBe(true);
		expect(matchesRule(rule({ attribute: 'country', value: 'us', valueType: RuleValueType.ENUM }), { country: 'US' })).toBe(true);
		expect(matchesRule(rule({ attribute: 'placed_at', operator: RuleOperator.GT, value: '2026-01-01T00:00:00Z', valueType: RuleValueType.DATE }), { placed_at: '2026-01-02T00:00:00Z' })).toBe(true);
	});

	it('compares money as an exact decimal, never through a double', () => {
		// The scale a stored column carries and the scale an operand was authored at differ, and the
		// comparison has to be about the amount rather than about the text.
		expect(matchesRule(rule({ attribute: 'total', value: '100.000000', valueType: RuleValueType.DECIMAL }), { total: '100' })).toBe(true);
		expect(
			matchesRule(
				rule({ attribute: 'total', operator: RuleOperator.GT, value: '99999999999999.999998', valueType: RuleValueType.DECIMAL }),
				{ total: '99999999999999.999999' }
			)
		).toBe(true);
		expect(
			matchesRule(
				rule({ attribute: 'total', operator: RuleOperator.GT, value: '0.3', valueType: RuleValueType.DECIMAL }),
				{ total: '0.1' }
			)
		).toBe(false);
	});

	it('refuses a value that cannot be coerced rather than widening the rule set', () => {
		const trace = { unresolvedAttributes: [] as string[], coercionFailures: [] as string[] };

		expect(matchesRule(rule({ attribute: 'total', operator: RuleOperator.GT, value: '10', valueType: RuleValueType.DECIMAL }), { total: 'not-a-number' }, trace)).toBe(false);
		expect(trace.coercionFailures).toEqual(['total']);
		// A type error in a rule is a configuration mistake; a mistaken rule must never match.
		expect(matchesRule(rule({ attribute: 'total', operator: RuleOperator.GT, value: '10', valueType: RuleValueType.DECIMAL, isNegated: true }), { total: 'nope' })).toBe(false);
	});

	it('reports an operator this build does not know instead of ignoring it', () => {
		const trace = { unresolvedAttributes: [] as string[], coercionFailures: [] as string[] };

		expect(matchesRule(rule({ attribute: 'a', operator: 'WHAT' as RuleOperator, value: 'a' }), { a: 'a' }, trace)).toBe(false);
		expect(trace.coercionFailures).toEqual(['a']);
	});

	it('treats IS_NULL as "nothing is there", not as "the column is null"', () => {
		const isNull = rule({ attribute: 'a', operator: RuleOperator.IS_NULL, value: null });

		expect(matchesRule(isNull, { a: null })).toBe(true);
		expect(matchesRule(isNull, { a: '' })).toBe(true);
		expect(matchesRule(isNull, { a: [] })).toBe(true);
		// Control: a false flag and a zero quantity are values, so an empty check that treated any
		// falsy value as absent would wrongly match both of these.
		expect(matchesRule(isNull, { a: false })).toBe(false);
		expect(matchesRule(isNull, { a: 0 })).toBe(false);
		// An attribute the context does not carry is unresolved, which is reported rather than matched.
		expect(matchesRule(isNull, {})).toBe(false);
	});

	it('anchors MATCHES, because a rule states that the attribute matches the pattern', () => {
		const postal = rule({ attribute: 'postal_code', operator: RuleOperator.MATCHES, value: '[MK][0-9][A-Z] ?[0-9][A-Z][0-9]' });

		expect(matchesRule(postal, { postal_code: 'M5V 2T6' })).toBe(true);
		expect(matchesRule(postal, { postal_code: 'XM5V 2T6' })).toBe(false);
		expect(matchesRule(postal, { postal_code: 'M5V 2T6X' })).toBe(false);
	});

	it('makes an unusable pattern a reported failure rather than a thrown exception', () => {
		const trace = { unresolvedAttributes: [] as string[], coercionFailures: [] as string[] };

		expect(matchesRule(rule({ attribute: 'code', operator: RuleOperator.MATCHES, value: '(' }), { code: 'A' }, trace)).toBe(false);
		expect(trace.coercionFailures).toEqual(['code']);
	});

	it('reads CONTAINS over a string, a collection and a JSON attribute', () => {
		const contains = (attribute: string, value: RuleOperand) => rule({ attribute, operator: RuleOperator.CONTAINS, value });

		expect(matchesRule(contains('email', '+wholesale'), { email: 'buyer+wholesale@example.test' })).toBe(true);
		expect(matchesRule(contains('tags', 'sale'), { tags: ['new', 'sale'] })).toBe(true);
		expect(matchesRule(contains('flags', 'vip'), { flags: { tier: 'vip' } })).toBe(true);
		expect(matchesRule(contains('tags', 'clearance'), { tags: ['new', 'sale'] })).toBe(false);
	});

	it('treats a scalar attribute as a member of the operand set, and an array as an intersection', () => {
		expect(matchesRule(rule({ attribute: 'code', operator: RuleOperator.IN, value: ['A', 'B'] }), { code: 'B' })).toBe(true);
		expect(matchesRule(rule({ attribute: 'codes', operator: RuleOperator.IN, value: ['Z', 'B'] }), { codes: ['A', 'B'] })).toBe(true);
		expect(matchesRule(rule({ attribute: 'codes', operator: RuleOperator.NOT_IN, value: ['Z'] }), { codes: ['A', 'B'] })).toBe(true);
		// An empty operand list cannot be coerced, so it fails closed rather than matching nothing or
		// everything by accident.
		expect(matchesRule(rule({ attribute: 'code', operator: RuleOperator.IN, value: [] }), { code: 'A' })).toBe(false);
	});

	it('makes NEQ the negation of EQ rather than a second implementation of it', () => {
		const context: RuleEvaluationContext = { code: 'B' };

		expect(matchesRule(rule({ attribute: 'code', operator: RuleOperator.NEQ, value: 'A' }), context)).toBe(
			matchesRule(rule({ attribute: 'code', operator: RuleOperator.EQ, value: 'A', isNegated: true }), context)
		);
		expect(matchesRule(rule({ attribute: 'code', operator: RuleOperator.NOT_IN, value: ['A'] }), context)).toBe(
			matchesRule(rule({ attribute: 'code', operator: RuleOperator.IN, value: ['A'], isNegated: true }), context)
		);
	});

	it('keeps BETWEEN inclusive on both ends', () => {
		const between = rule({ attribute: 'quantity', operator: RuleOperator.BETWEEN, value: [6, 11], valueType: RuleValueType.NUMBER });

		expect(matchesRule(between, { quantity: 6 })).toBe(true);
		expect(matchesRule(between, { quantity: 11 })).toBe(true);
		expect(matchesRule(between, { quantity: 12 })).toBe(false);
		expect(matchesRule(between, { quantity: 5 })).toBe(false);
		// A range that is not a two-element range is a shape error, not a range that happens to match.
		expect(matchesRule(rule({ attribute: 'quantity', operator: RuleOperator.BETWEEN, value: [6], valueType: RuleValueType.NUMBER }), { quantity: 6 })).toBe(false);
	});
});

describe('evaluateRuleSet', () => {
	/** The worked example the pricing specification states in words: two AND-ed conditions OR a third. */
	const workedExample = [
		rule({ id: 'r1', groupIndex: 0, attribute: 'customer.groups.code', value: 'WHOLESALE' }),
		rule({ id: 'r2', groupIndex: 0, attribute: 'shipping_address.country_code', value: 'CA' }),
		rule({ id: 'r3', groupIndex: 1, attribute: 'customer.total_spent', operator: RuleOperator.GTE, value: '5000.000000', valueType: RuleValueType.DECIMAL })
	];

	it('treats an empty condition set as no restriction at all', () => {
		expect(evaluateRuleSet([], {})).toEqual({
			matched: true,
			matchedRules: [],
			failedRules: [],
			unresolvedAttributes: [],
			coercionFailures: []
		});
		expect(ruleSetMatches(undefined, {})).toBe(true);
		expect(ruleSetMatches(null, {})).toBe(true);
	});

	it('ANDs the rules of one group and ORs the groups', () => {
		expect(
			ruleSetMatches(workedExample, {
				customer: { groups: { code: 'WHOLESALE' } },
				shipping_address: { country_code: 'CA' }
			})
		).toBe(true);
		expect(
			ruleSetMatches(workedExample, {
				customer: { groups: { code: 'WHOLESALE' } },
				shipping_address: { country_code: 'US' }
			})
		).toBe(false);
		expect(ruleSetMatches(workedExample, { customer: { total_spent: '5000' } })).toBe(true);
		expect(ruleSetMatches(workedExample, { customer: { total_spent: '4999.999999' } })).toBe(false);
		expect(ruleSetMatches(workedExample, {})).toBe(false);
	});

	it('does not require group indices to be contiguous or to start at zero', () => {
		expect(
			ruleSetMatches([rule({ attribute: 'a', value: 'no' }), rule({ groupIndex: 7, attribute: 'b', operator: RuleOperator.IS_NULL, value: null })], { b: null })
		).toBe(true);
	});

	it('ignores a deactivated rule, because a disabled rule must not restrict anything', () => {
		expect(ruleSetMatches([rule({ attribute: 'code', value: 'A', isActive: false })], {})).toBe(true);
		expect(ruleSetMatches([rule({ attribute: 'code', value: 'A', isActive: false })], {}, { includeInactive: true })).toBe(false);
	});

	it('records what matched and what did not, in group then priority order', () => {
		const trace = evaluateRuleSet(
			[
				rule({ id: 'b', groupIndex: 0, priority: 2, attribute: 'b', value: 'yes' }),
				rule({ id: 'a', groupIndex: 0, priority: 1, attribute: 'a', value: 'yes' }),
				rule({ id: 'c', groupIndex: 1, attribute: 'c', value: 'no' })
			],
			{ a: 'yes', b: 'no', c: 'no' }
		);

		expect(trace.matchedRules).toEqual(['a', 'c']);
		expect(trace.failedRules).toEqual(['b']);
		expect(trace.matched).toBe(true);
	});

	it('lets priority order the trace without changing the verdict, because AND is commutative', () => {
		// Control for the case above: the naive reading of "precedence between rules by priority" is
		// that the higher-priority rule decides the group. It does not — a group is a conjunction — so
		// swapping the priorities moves the trace and leaves the verdict alone.
		const context = { a: 'no', b: 'no' };
		const first = evaluateRuleSet(
			[
				rule({ id: 'b', priority: 2, attribute: 'b', value: 'yes' }),
				rule({ id: 'a', priority: 1, attribute: 'a', value: 'yes' })
			],
			context
		);
		const swapped = evaluateRuleSet(
			[
				rule({ id: 'b', priority: 1, attribute: 'b', value: 'yes' }),
				rule({ id: 'a', priority: 2, attribute: 'a', value: 'yes' })
			],
			context
		);

		expect(first.failedRules).toEqual(['a', 'b']);
		expect(swapped.failedRules).toEqual(['b', 'a']);
		expect(first.matched).toBe(false);
		expect(swapped.matched).toBe(false);
	});

	it('keeps evaluating the remaining groups after one has already matched', () => {
		// The verdict short-circuits in the sense that one satisfied group is enough; the trace does
		// not, which is what an operator reads to find out why a second group never fires.
		const trace = evaluateRuleSet(
			[
				rule({ id: 'hit', groupIndex: 0, attribute: 'code', value: 'A' }),
				rule({ id: 'later', groupIndex: 1, attribute: 'missing.path', value: 'A' })
			],
			{ code: 'A' }
		);

		expect(trace.matched).toBe(true);
		expect(trace.matchedRules).toEqual(['hit']);
		expect(trace.failedRules).toEqual(['later']);
		expect(trace.unresolvedAttributes).toEqual(['missing.path']);
	});

	it('names a rule by its id when it has one and by its attribute otherwise', () => {
		const trace = evaluateRuleSet(
			[rule({ id: 'r1', attribute: 'a', value: 'yes' }), rule({ id: undefined, attribute: 'b', value: 'yes' })],
			{ a: 'yes', b: 'no' }
		);

		expect(trace.matchedRules).toEqual(['r1']);
		expect(trace.failedRules).toEqual(['b']);
	});

	it('treats an incomplete rule row as a failure rather than as absent', () => {
		expect(ruleSetMatches([undefined as unknown as IRule], {})).toBe(true);
		expect(ruleSetMatches([rule({ attribute: '', value: 'A' })], {})).toBe(false);
	});
});
