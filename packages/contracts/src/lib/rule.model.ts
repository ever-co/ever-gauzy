import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * What owns a rule set.
 *
 * A rule is polymorphic: `ownerId` points at a row in one of the tables below, and there is no
 * foreign key, because the target table depends on this value. A capability that needs conditional
 * behaviour adds a value here and registers a context mapping — it never adds a rule table, an
 * operator set or an evaluator of its own.
 */
export enum RuleOwnerType {
	/** Membership of a rule-based or hybrid collection. */
	COLLECTION = 'COLLECTION',
	/** Conditions for a whole price list to be eligible for a context. */
	PRICE_LIST = 'PRICE_LIST',
	/** Conditions for one price row to apply — a quantity band, a group or a channel restriction. */
	PRICE = 'PRICE',
	/** Conditions for a promotion to be a candidate. */
	PROMOTION = 'PROMOTION',
	/** Target and buy selection for a promotion action. */
	PROMOTION_ACTION = 'PROMOTION_ACTION',
	/** Eligibility and pricing conditions of a shipping option. */
	SHIPPING_OPTION = 'SHIPPING_OPTION',
	/** Conditions narrowing a tax rate — product, category, price band, customer exemption. */
	TAX_RATE = 'TAX_RATE',
	/** Membership predicate of a rule-based customer segment. */
	CUSTOMER_SEGMENT = 'CUSTOMER_SEGMENT',
	/** Availability conditions of a payment provider. */
	PAYMENT_PROVIDER = 'PAYMENT_PROVIDER',
	/** Conditions for a fulfilment option offered by a provider strategy. */
	FULFILLMENT_OPTION = 'FULFILLMENT_OPTION',
	/** Constraints a stock-allocation strategy applies. */
	STOCK_ALLOCATION = 'STOCK_ALLOCATION',
	/** Conditions that route a request to an approval policy and chain. */
	APPROVAL_POLICY = 'APPROVAL_POLICY',
	/** Put-away and picking constraints attached to one warehouse bin. */
	WAREHOUSE_BIN = 'WAREHOUSE_BIN',
	/** Eligibility conditions for a seller or one of its offerings. */
	SELLER = 'SELLER'
}

/**
 * Which slice of the evaluation context a rule's attribute is read from.
 */
export enum RuleScope {
	/** The document-level context: totals, item count, currency. */
	ORDER = 'ORDER',
	/** One line's context. The rule is satisfied when any line matches. */
	ITEM = 'ITEM',
	/** The shipping context: destination, method, weight. */
	SHIPPING = 'SHIPPING',
	/** The buy side of a buy-and-get action. */
	BUY = 'BUY',
	/** The target side of an action: which lines the benefit applies to. */
	TARGET = 'TARGET',
	/** The customer context: groups, order count, exemption, loyalty balance. */
	CUSTOMER = 'CUSTOMER',
	/** The approval request's own context. */
	REQUEST = 'REQUEST',
	/** The request context: channel, region, locale, time of day. */
	CONTEXT = 'CONTEXT'
}

/**
 * The comparison a rule performs between its attribute and its operand.
 *
 * The operand shape is fixed per operator: an array for `IN`, `NOT_IN` and `BETWEEN`, a single
 * scalar otherwise, and nothing at all for `IS_NULL`.
 */
export enum RuleOperator {
	EQ = 'EQ',
	NEQ = 'NEQ',
	IN = 'IN',
	NOT_IN = 'NOT_IN',
	GT = 'GT',
	GTE = 'GTE',
	LT = 'LT',
	LTE = 'LTE',
	CONTAINS = 'CONTAINS',
	STARTS_WITH = 'STARTS_WITH',
	ENDS_WITH = 'ENDS_WITH',
	BETWEEN = 'BETWEEN',
	IS_NULL = 'IS_NULL',
	MATCHES = 'MATCHES'
}

/**
 * How the operand is coerced before it is compared with the attribute.
 *
 * `DECIMAL` exists alongside `NUMBER` because a monetary or rate operand has to be compared as an
 * exact decimal: a JSON number in a `DECIMAL` rule is a configuration mistake, not a value to be
 * coerced.
 */
export enum RuleValueType {
	STRING = 'STRING',
	NUMBER = 'NUMBER',
	DECIMAL = 'DECIMAL',
	BOOLEAN = 'BOOLEAN',
	DATE = 'DATE',
	ENUM = 'ENUM'
}

/**
 * A single operand value.
 */
export type RuleScalar = string | number | boolean | null;

/**
 * A rule's operand: a scalar, or an array of scalars for the operators that compare against a set.
 */
export type RuleOperand = RuleScalar | RuleScalar[];

/**
 * One condition of a rule set.
 *
 * Rules sharing a `groupIndex` are AND-ed and the groups are OR-ed, which is how
 * `(A and B) or (C and D)` is expressed without a nested rule tree.
 */
export interface IRule extends IBasePerTenantAndOrganizationEntityModel {
	/** What the rule set belongs to. */
	ownerType: RuleOwnerType;

	/** Id of the owning row. Polymorphic, so it carries no foreign key. */
	ownerId: ID;

	/** Which context slice the attribute is read from. */
	scope: RuleScope;

	/** Dotted path into the evaluation context, for example `customer.groups.id`. */
	attribute: string;

	/** The comparison the rule performs. */
	operator: RuleOperator;

	/** The operand. An array exactly when the operator requires one, `null` only for `IS_NULL`. */
	value?: RuleOperand;

	/** How the operand is coerced before comparison. */
	valueType: RuleValueType;

	/** Wraps the whole rule in `NOT`, after the operator has been evaluated. */
	isNegated: boolean;

	/** Rules sharing this value are AND-ed; the groups are OR-ed. */
	groupIndex: number;

	/** Evaluation order within a group. */
	priority: number;

	/** Operator-facing explanation carried on the rule. */
	description?: string;
}

/**
 * The object a rule set is evaluated against.
 *
 * The shape is supplied by the domain that registered the rule's owner type; the evaluator only
 * walks the dotted attribute path through it.
 */
export type RuleEvaluationContext = Record<string, unknown>;

/**
 * What an evaluation decided, and why.
 *
 * The trace exists so that an operator can see why a promotion "never fires": an attribute that the
 * context does not carry at all, and one whose value could not be coerced to the rule's value type,
 * are the two silent ways a rule stops matching.
 */
export interface IRuleEvaluationResult {
	/** Whether the rule set as a whole matched. */
	matched: boolean;

	/** Rules that matched, identified by id when the row has one and by attribute otherwise. */
	matchedRules: string[];

	/** Rules that did not match. */
	failedRules: string[];

	/** Attributes that the context does not resolve; each one makes its rule not match. */
	unresolvedAttributes: string[];

	/** Attributes whose value could not be coerced to the rule's value type. */
	coercionFailures: string[];
}

/**
 * Input for creating or updating a rule.
 */
export interface IRuleCreateInput extends Partial<Omit<IRule, 'id' | 'ownerType' | 'ownerId' | 'attribute' | 'operator'>> {
	ownerType: RuleOwnerType;
	ownerId: ID;
	attribute: string;
	operator: RuleOperator;
}
