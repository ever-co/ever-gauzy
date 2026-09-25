import { Logger } from '@nestjs/common';
import {
	IRule,
	IRuleEvaluationResult,
	RuleEvaluationContext,
	RuleOperator,
	RuleValueType
} from '@gauzy/contracts';
import { compareDecimalStrings, normalizeDecimalString } from '../money/decimal';
import { RULE_MAX_MATCH_INPUT } from './rule.pattern-safety';
import { RULE_MATCHES_PATTERN_OPTIONS, describePattern } from './rule.validator';

/**
 * The platform's rule evaluator.
 *
 * A rule set is a list of `rule` rows and a context object. The evaluator is pure — it reads no
 * database and no request context — so a seed script, a migration, a strategy and a test all evaluate
 * a rule set exactly as the API does.
 *
 * Three decisions in this file are load-bearing:
 *
 * 1. **A path the context does not resolve is not a match, and that verdict is reached before
 *    negation.** `NOT` over an unconfigured attribute would otherwise make a rule match everything,
 *    which is the most dangerous corner of the language.
 * 2. **A value that cannot be coerced is treated the same way.** A type error in a rule is a
 *    configuration mistake, and a mistake must never widen a rule set.
 * 3. **Comparison is exact.** Decimals are compared as scaled integers and never by subtracting two
 *    `number`s, so `0.1 + 0.2` style error cannot decide whether a promotion fires.
 *
 * Scope decides *which* context the caller passes: `ITEM` rules are evaluated once per line with the
 * line's own context, `TARGET`/`BUY` rules once per candidate item, and `ORDER`/`CUSTOMER`/`CONTEXT`
 * rules once against the document context. The evaluator never aggregates across lines itself; doing
 * so would take that decision away from the domain that knows what a line is.
 */

/** The outcome of resolving a dotted attribute path. */
export interface IResolvedAttribute {
	/** Whether the context carries the path. */
	resolved: boolean;

	/** The value at the path, when it resolved. */
	value?: unknown;
}

/** A value coerced to the type its rule compares in. */
interface IComparable {
	/** The kind of comparison the value takes part in. */
	kind: 'decimal' | 'date' | 'boolean' | 'string';

	/** Canonical text of the value. */
	text: string;

	/** Epoch milliseconds, for date values. */
	instant?: number;
}

/** What one operator decided, and whether it could decide at all. */
interface IOperatorOutcome {
	/** Whether the operator matched. */
	matched: boolean;

	/** Whether the comparison could not be made because a value did not coerce. */
	coercionFailed: boolean;
}

/** The part of an evaluation result an individual rule contributes to. */
type RuleEvaluationTrace = Pick<IRuleEvaluationResult, 'unresolvedAttributes' | 'coercionFailures'>;

/**
 * Compiled `MATCHES` patterns.
 *
 * A pattern is compiled once per distinct value rather than once per row per evaluation, because a
 * promotion is evaluated on every cart write. The cache is bounded so that a tenant authoring
 * thousands of distinct patterns cannot grow it without limit.
 */
const compiledPatterns = new Map<string, RegExp | null>();
const MAX_COMPILED_PATTERNS = 500;

/**
 * Where a refused `MATCHES` pattern is reported. Nest's logger works outside Nest too, which is what
 * a seed script and a migration need of it.
 */
const logger = new Logger('RuleEvaluator');

/**
 * Resolves a dotted attribute path against an evaluation context.
 *
 * The walk only follows own properties. That is not decoration: a path is authored by an
 * administrator and evaluated against a live context, and walking the prototype chain would let a path
 * such as `constructor.name` resolve to something that is not part of the context at all.
 *
 * @param context The context to read.
 * @param path The dotted path, for example `customer.groups.code`.
 * @returns Whether the path resolved, and the value when it did. A missing path is reported, never
 * thrown: an attribute the context does not carry makes its rule not match.
 */
export function resolveAttributePath(
	context: RuleEvaluationContext | null | undefined,
	path: string
): IResolvedAttribute {
	if (!context || typeof context !== 'object' || typeof path !== 'string' || path === '') {
		return { resolved: false };
	}

	let current: unknown = context;

	for (const segment of path.split('.')) {
		if (segment === '' || current === null || current === undefined || typeof current !== 'object') {
			return { resolved: false };
		}

		if (!Object.prototype.hasOwnProperty.call(current, segment)) {
			return { resolved: false };
		}

		current = (current as Record<string, unknown>)[segment];
	}

	return { resolved: true, value: current };
}

/**
 * @param value The value to coerce.
 * @param valueType The type the rule compares in.
 * @returns The comparable value, or null when it cannot be coerced.
 */
function toComparable(value: unknown, valueType: RuleValueType): IComparable | null {
	switch (valueType) {
		case RuleValueType.NUMBER:
		case RuleValueType.DECIMAL:
			return toDecimalComparable(value);
		case RuleValueType.BOOLEAN:
			return toBooleanComparable(value);
		case RuleValueType.DATE:
			return toDateComparable(value);
		case RuleValueType.ENUM:
			return toTextComparable(value, true);
		case RuleValueType.STRING:
		default:
			return toTextComparable(value, false);
	}
}

/**
 * @param value The value to coerce.
 * @returns The decimal comparable, or null.
 */
function toDecimalComparable(value: unknown): IComparable | null {
	if (typeof value === 'bigint') {
		return { kind: 'decimal', text: value.toString() };
	}

	if (typeof value !== 'number' && typeof value !== 'string') {
		return null;
	}

	if (typeof value === 'number' && !Number.isFinite(value)) {
		return null;
	}

	try {
		// Normalisation is what makes `100` and `100.000000` the same operand, which is what a rule
		// written against a column of one scale and a context of another needs.
		return { kind: 'decimal', text: normalizeDecimalString(value) };
	} catch {
		return null;
	}
}

/**
 * @param value The value to coerce.
 * @param upperCase Whether the comparison is case-insensitive, as enum values are.
 * @returns The text comparable, or null.
 */
function toTextComparable(value: unknown, upperCase: boolean): IComparable | null {
	if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
		return null;
	}

	const text = String(value).trim();

	return { kind: 'string', text: upperCase ? text.toUpperCase() : text };
}

/**
 * @param value The value to coerce.
 * @returns The boolean comparable, or null.
 */
function toBooleanComparable(value: unknown): IComparable | null {
	if (typeof value === 'boolean') {
		return { kind: 'boolean', text: value ? 'true' : 'false' };
	}

	if (value === 1 || value === '1' || value === 'true' || value === 'TRUE') {
		return { kind: 'boolean', text: 'true' };
	}

	if (value === 0 || value === '0' || value === 'false' || value === 'FALSE') {
		return { kind: 'boolean', text: 'false' };
	}

	return null;
}

/**
 * @param value The value to coerce.
 * @returns The date comparable, or null. A date-only string means midnight UTC.
 */
function toDateComparable(value: unknown): IComparable | null {
	if (value instanceof Date) {
		const instant = value.getTime();

		return Number.isNaN(instant) ? null : { kind: 'date', text: value.toISOString(), instant };
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? { kind: 'date', text: String(value), instant: value } : null;
	}

	if (typeof value === 'string') {
		const instant = Date.parse(value);

		return Number.isNaN(instant) ? null : { kind: 'date', text: value, instant };
	}

	return null;
}

/**
 * Coerces a list of values, ignoring the entries that do not coerce.
 *
 * @param values The values to coerce.
 * @param valueType The type the rule compares in.
 * @returns The comparables, or null when the list is not a list or nothing in it coerced.
 */
function toComparableList(values: readonly unknown[], valueType: RuleValueType): IComparable[] | null {
	if (!Array.isArray(values)) {
		return null;
	}

	const comparables = values
		.map((value) => toComparable(value, valueType))
		.filter((comparable): comparable is IComparable => comparable !== null);

	return comparables.length === 0 ? null : comparables;
}

/**
 * @param left One comparable.
 * @param right Another comparable.
 * @returns -1, 0 or 1, or null when the two are not of the same kind and cannot be ordered.
 */
function compareComparables(left: IComparable, right: IComparable): -1 | 0 | 1 | null {
	if (left.kind !== right.kind) {
		return null;
	}

	switch (left.kind) {
		case 'decimal':
			return compareDecimalStrings(left.text, right.text);
		case 'date': {
			const leftInstant = left.instant ?? 0;
			const rightInstant = right.instant ?? 0;

			if (leftInstant === rightInstant) {
				return 0;
			}

			return leftInstant < rightInstant ? -1 : 1;
		}
		case 'boolean':
		case 'string':
		default:
			if (left.text === right.text) {
				return 0;
			}

			return left.text < right.text ? -1 : 1;
	}
}

/**
 * @param left One comparable.
 * @param right Another comparable.
 * @returns True when the two represent the same value.
 */
function equalsComparable(left: IComparable, right: IComparable): boolean {
	return compareComparables(left, right) === 0;
}

/**
 * @param pattern The pattern to compile.
 * @returns The compiled pattern, or null when it is not a usable regular expression. A pattern that
 * does not compile is a configuration mistake, and it makes its rule not match rather than throwing
 * in the middle of a pricing run.
 *
 * 🛑 **The safety analysis is applied here and not only on the write path.** `validateRuleDefinition`
 * is reached from `RuleService.createForOwner`, `replaceOwnerRules` and `assertWritable` and from
 * nowhere else, so a row that arrived by a seed, an import, a migration, a restore from a backup
 * taken before the analysis existed, the inherited `CrudService` create and update, or a future
 * writer that does not route through the service was compiled and executed unscreened — and the cache
 * guaranteed the hostile pattern was reused rather than recompiled, so every evaluation paid the full
 * cost. The verdict is cached alongside the compiled form, so the analysis runs once per distinct
 * pattern rather than once per evaluation, and a refusal is logged once for the same reason.
 *
 * A refused pattern answers `null`, which this function already documents as "the rule does not
 * match": the evaluator's second rule — a value that cannot be compared does not widen a rule set —
 * is what makes that the safe direction to fail in.
 */
function compilePattern(pattern: string): RegExp | null {
	const cached = compiledPatterns.get(pattern);

	if (cached !== undefined) {
		return cached;
	}

	let compiled: RegExp | null = null;
	const verdict = describePattern(pattern, RULE_MATCHES_PATTERN_OPTIONS);

	if (verdict.safe) {
		try {
			// Anchored, and without flags — which is what `RULE_MATCHES_PATTERN_OPTIONS` tells the analysis:
			// a rule states that the attribute *matches* the pattern, not that the pattern occurs
			// somewhere inside it.
			compiled = new RegExp(`^(?:${pattern})$`);
		} catch {
			compiled = null;
		}
	} else {
		// The pattern text is quoted, and cut short, because it is author-controlled and may be long.
		logger.warn(
			`A MATCHES rule does not match anything until its pattern is rewritten: the pattern ${JSON.stringify(
				pattern.slice(0, 64)
			)}${pattern.length > 64 ? '…' : ''} was refused (${verdict.reason}). ${verdict.detail ?? ''}`.trim()
		);
	}

	if (compiledPatterns.size >= MAX_COMPILED_PATTERNS) {
		compiledPatterns.clear();
	}

	compiledPatterns.set(pattern, compiled);

	return compiled;
}

/**
 * @param attributeValue The resolved attribute value.
 * @returns True when the value is absent, empty or an empty collection, which is what `IS_NULL`
 * means: "nothing is there", not merely "the column is null".
 */
function isEmptyValue(attributeValue: unknown): boolean {
	if (attributeValue === null || attributeValue === undefined) {
		return true;
	}

	if (typeof attributeValue === 'string') {
		return attributeValue.length === 0;
	}

	if (Array.isArray(attributeValue)) {
		return attributeValue.length === 0;
	}

	return false;
}

/**
 * @returns The outcome of a comparison that could not be made.
 */
function coercionFailure(): IOperatorOutcome {
	return { matched: false, coercionFailed: true };
}

/**
 * Evaluates the `EQ` family: a scalar attribute is equal to the operand, an array attribute contains
 * it.
 *
 * @param operator The operator being evaluated.
 * @param attributeValue The resolved attribute value.
 * @param operand The rule's operand.
 * @param valueType The type the rule compares in.
 * @returns What the operator decided.
 */
function evaluateEquality(
	operator: RuleOperator,
	attributeValue: unknown,
	operand: unknown,
	valueType: RuleValueType
): IOperatorOutcome {
	const operands = toComparableList(Array.isArray(operand) ? operand : [operand], valueType);

	if (!operands) {
		return coercionFailure();
	}

	let matched: boolean;

	if (Array.isArray(attributeValue)) {
		const candidates = toComparableList(attributeValue, valueType);

		if (!candidates) {
			return coercionFailure();
		}

		matched = candidates.some((candidate) => operands.some((entry) => equalsComparable(candidate, entry)));
	} else {
		const candidate = toComparable(attributeValue, valueType);

		if (!candidate) {
			return coercionFailure();
		}

		matched = operands.some((entry) => equalsComparable(candidate, entry));
	}

	// `NEQ` is `NOT (EQ)`, evaluated after the operator rather than folded into it, so that the two
	// spellings of the same condition cannot drift apart.
	return { matched: operator === RuleOperator.NEQ ? !matched : matched, coercionFailed: false };
}

/**
 * Evaluates the `IN` family: a scalar attribute is a member of the operand set, an array attribute
 * intersects it.
 *
 * @param operator The operator being evaluated.
 * @param attributeValue The resolved attribute value.
 * @param operand The rule's operand.
 * @param valueType The type the rule compares in.
 * @returns What the operator decided.
 */
function evaluateMembership(
	operator: RuleOperator,
	attributeValue: unknown,
	operand: unknown,
	valueType: RuleValueType
): IOperatorOutcome {
	// A scalar operand is treated as a one-element set: the validator rejects that shape when a rule is
	// written, and a rule that predates the validator must still evaluate rather than throw.
	const operands = toComparableList(Array.isArray(operand) ? operand : [operand], valueType);

	if (!operands) {
		return coercionFailure();
	}

	let matched: boolean;

	if (Array.isArray(attributeValue)) {
		const candidates = toComparableList(attributeValue, valueType);

		if (!candidates) {
			return coercionFailure();
		}

		matched = candidates.some((candidate) => operands.some((entry) => equalsComparable(candidate, entry)));
	} else {
		const candidate = toComparable(attributeValue, valueType);

		if (!candidate) {
			return coercionFailure();
		}

		matched = operands.some((entry) => equalsComparable(candidate, entry));
	}

	return { matched: operator === RuleOperator.NOT_IN ? !matched : matched, coercionFailed: false };
}

/**
 * Evaluates an ordering operator.
 *
 * @param operator The operator being evaluated.
 * @param attributeValue The resolved attribute value.
 * @param operand The rule's operand.
 * @param valueType The type the rule compares in.
 * @returns What the operator decided.
 */
function evaluateOrdering(
	operator: RuleOperator,
	attributeValue: unknown,
	operand: unknown,
	valueType: RuleValueType
): IOperatorOutcome {
	const candidate = toComparable(attributeValue, valueType);
	const entry = Array.isArray(operand) ? null : toComparable(operand, valueType);

	if (!candidate || !entry) {
		return coercionFailure();
	}

	const comparison = compareComparables(candidate, entry);

	if (comparison === null) {
		return coercionFailure();
	}

	switch (operator) {
		case RuleOperator.GT:
			return { matched: comparison > 0, coercionFailed: false };
		case RuleOperator.GTE:
			return { matched: comparison >= 0, coercionFailed: false };
		case RuleOperator.LT:
			return { matched: comparison < 0, coercionFailed: false };
		case RuleOperator.LTE:
		default:
			return { matched: comparison <= 0, coercionFailed: false };
	}
}

/**
 * Evaluates `BETWEEN`, which is inclusive on both ends.
 *
 * @param attributeValue The resolved attribute value.
 * @param operand The rule's two-element operand.
 * @param valueType The type the rule compares in.
 * @returns What the operator decided.
 */
function evaluateBetween(attributeValue: unknown, operand: unknown, valueType: RuleValueType): IOperatorOutcome {
	if (!Array.isArray(operand) || operand.length !== 2) {
		return coercionFailure();
	}

	const candidate = toComparable(attributeValue, valueType);
	const low = toComparable(operand[0], valueType);
	const high = toComparable(operand[1], valueType);

	if (!candidate || !low || !high) {
		return coercionFailure();
	}

	const aboveLow = compareComparables(candidate, low);
	const belowHigh = compareComparables(candidate, high);

	if (aboveLow === null || belowHigh === null) {
		return coercionFailure();
	}

	return { matched: aboveLow >= 0 && belowHigh <= 0, coercionFailed: false };
}

/**
 * Evaluates `CONTAINS`, over a string, an array or a JSON collection.
 *
 * @param attributeValue The resolved attribute value.
 * @param operand The rule's operand.
 * @param valueType The type the rule compares in.
 * @returns What the operator decided.
 */
function evaluateContains(attributeValue: unknown, operand: unknown, valueType: RuleValueType): IOperatorOutcome {
	const entry = Array.isArray(operand) ? null : toComparable(operand, valueType);

	if (!entry) {
		return coercionFailure();
	}

	if (typeof attributeValue === 'string') {
		// A substring test is made on the text as it is: a case-insensitive comparison is expressed by
		// the `ENUM` value type, not by guessing here.
		return { matched: attributeValue.includes(entry.text), coercionFailed: false };
	}

	if (Array.isArray(attributeValue)) {
		const candidates = toComparableList(attributeValue, valueType);

		return candidates
			? { matched: candidates.some((candidate) => equalsComparable(candidate, entry)), coercionFailed: false }
			: coercionFailure();
	}

	if (attributeValue !== null && typeof attributeValue === 'object') {
		const candidates = Object.values(attributeValue as Record<string, unknown>)
			.map((value) => toComparable(value, valueType))
			.filter((comparable): comparable is IComparable => comparable !== null);

		return candidates.length > 0
			? { matched: candidates.some((candidate) => equalsComparable(candidate, entry)), coercionFailed: false }
			: coercionFailure();
	}

	return coercionFailure();
}

/**
 * Evaluates a prefix or suffix test.
 *
 * @param operator The operator being evaluated.
 * @param attributeValue The resolved attribute value.
 * @param operand The rule's operand.
 * @returns What the operator decided.
 */
function evaluateAffix(operator: RuleOperator, attributeValue: unknown, operand: unknown): IOperatorOutcome {
	if (typeof attributeValue !== 'string' || typeof operand !== 'string') {
		return coercionFailure();
	}

	return {
		matched:
			operator === RuleOperator.STARTS_WITH ? attributeValue.startsWith(operand) : attributeValue.endsWith(operand),
		coercionFailed: false
	};
}

/**
 * Applies a rule's operator to a resolved attribute value.
 *
 * @param rule The rule.
 * @param attributeValue The resolved attribute value.
 * @returns What the operator decided.
 */
function applyOperator(
	rule: Pick<IRule, 'operator' | 'value' | 'valueType'>,
	attributeValue: unknown
): IOperatorOutcome {
	const valueType = rule.valueType ?? RuleValueType.STRING;

	switch (rule.operator) {
		case RuleOperator.IS_NULL:
			// The operand carries no value at all: the operator is about the attribute's own presence.
			return { matched: isEmptyValue(attributeValue), coercionFailed: false };
		case RuleOperator.EQ:
		case RuleOperator.NEQ:
			return evaluateEquality(rule.operator, attributeValue, rule.value, valueType);
		case RuleOperator.IN:
		case RuleOperator.NOT_IN:
			return evaluateMembership(rule.operator, attributeValue, rule.value, valueType);
		case RuleOperator.GT:
		case RuleOperator.GTE:
		case RuleOperator.LT:
		case RuleOperator.LTE:
			return evaluateOrdering(rule.operator, attributeValue, rule.value, valueType);
		case RuleOperator.BETWEEN:
			return evaluateBetween(attributeValue, rule.value, valueType);
		case RuleOperator.CONTAINS:
			return evaluateContains(attributeValue, rule.value, valueType);
		case RuleOperator.STARTS_WITH:
		case RuleOperator.ENDS_WITH:
			return evaluateAffix(rule.operator, attributeValue, rule.value);
		case RuleOperator.MATCHES: {
			if (typeof attributeValue !== 'string' || typeof rule.value !== 'string') {
				return coercionFailure();
			}

			// The subject is bounded, and this is the bound that does not depend on the pattern
			// analysis being complete. A pattern that survives the analysis has no nested loop and at
			// most one pair of repetitions that can slide against each other, so its worst remaining
			// case is polynomial in the length of what it is matched against — and what it is matched
			// against is buyer-controlled text: a SKU, an email, a customer attribute. Capping it turns
			// "polynomial in whatever the buyer sent" into "polynomial in 512", which is a constant.
			//
			// Over the cap the comparison is reported as one that could not be made, which the
			// evaluator already treats as not matching and records in the trace, rather than silently
			// answering false: a rule that stopped applying is a fact an operator needs to see.
			if (attributeValue.length > RULE_MAX_MATCH_INPUT) {
				return coercionFailure();
			}

			const pattern = compilePattern(rule.value);

			return pattern ? { matched: pattern.test(attributeValue), coercionFailed: false } : coercionFailure();
		}
		default:
			// An operator the evaluator does not know is a rule written by a newer version of the
			// platform; it does not match, and it is reported rather than ignored.
			return coercionFailure();
	}
}

/**
 * Evaluates one rule against a context.
 *
 * @param rule The rule.
 * @param context The context the rule's scope selects.
 * @param trace Where to record why the rule did not match, when the caller wants the reason.
 * @returns True when the rule matched.
 */
export function matchesRule(
	rule: Pick<IRule, 'attribute' | 'operator' | 'value' | 'valueType' | 'isNegated'>,
	context: RuleEvaluationContext | null | undefined,
	trace?: RuleEvaluationTrace
): boolean {
	const resolved = resolveAttributePath(context, rule.attribute);

	if (!resolved.resolved) {
		// Stated explicitly because it is the corner of the language that bites: an unresolved attribute
		// makes the rule false *before* negation, so `isNegated` cannot turn "not configured" into
		// "matches everything".
		trace?.unresolvedAttributes.push(rule.attribute);
		return false;
	}

	const outcome = applyOperator(rule, resolved.value);

	if (outcome.coercionFailed) {
		// A value that cannot be coerced is a configuration mistake and is treated exactly like an
		// unresolved attribute, for the same reason.
		trace?.coercionFailures.push(rule.attribute);
		return false;
	}

	return rule.isNegated === true ? !outcome.matched : outcome.matched;
}

/**
 * Evaluates a rule set against a context.
 *
 * Rules sharing a `groupIndex` are AND-ed and the groups are OR-ed; the group indices need not be
 * contiguous or start at zero. An empty rule set matches everything, which is the correct default for
 * "no restriction" — an owner that has configured no conditions is eligible.
 *
 * @param rules The rule rows.
 * @param context The context the rules' scope selects.
 * @param options.includeInactive Whether to evaluate rules an administrator deactivated. Off by
 * default: a disabled rule must not restrict anything.
 * @returns Whether the set matched, and the trace that explains it.
 */
export function evaluateRuleSet(
	rules: readonly IRule[] | null | undefined,
	context: RuleEvaluationContext | null | undefined,
	options: { includeInactive?: boolean } = {}
): IRuleEvaluationResult {
	const result: IRuleEvaluationResult = {
		matched: false,
		matchedRules: [],
		failedRules: [],
		unresolvedAttributes: [],
		coercionFailures: []
	};

	const active = (rules ?? []).filter(
		(rule): rule is IRule => !!rule && (options.includeInactive === true || rule.isActive !== false)
	);

	if (active.length === 0) {
		result.matched = true;
		return result;
	}

	const groups = new Map<number, IRule[]>();

	for (const rule of active) {
		const groupIndex = Number.isFinite(rule.groupIndex) ? rule.groupIndex : 0;
		const group = groups.get(groupIndex) ?? [];

		group.push(rule);
		groups.set(groupIndex, group);
	}

	const orderedGroups = [...groups.entries()].sort(([left], [right]) => left - right);

	for (const [, group] of orderedGroups) {
		// `AND` is commutative, so the order changes nothing about the verdict; it decides only which
		// failed rule the trace records first.
		const ordered = [...group].sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
		let groupMatched = true;

		for (const rule of ordered) {
			const matched = matchesRule(rule, context, result);
			const key = rule.id ?? rule.attribute;

			if (matched) {
				result.matchedRules.push(key);
			} else {
				result.failedRules.push(key);
				groupMatched = false;
			}
		}

		if (groupMatched) {
			result.matched = true;
		}
	}

	return result;
}

/**
 * Evaluates a rule set and returns only the verdict.
 *
 * @param rules The rule rows.
 * @param context The context the rules' scope selects.
 * @param options.includeInactive Whether to evaluate deactivated rules.
 * @returns True when the rule set matched.
 */
export function ruleSetMatches(
	rules: readonly IRule[] | null | undefined,
	context: RuleEvaluationContext | null | undefined,
	options: { includeInactive?: boolean } = {}
): boolean {
	return evaluateRuleSet(rules, context, options).matched;
}
