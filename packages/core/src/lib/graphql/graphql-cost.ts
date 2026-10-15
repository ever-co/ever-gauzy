import { getNamedType, getNullableType, isInterfaceType, isListType, isObjectType } from 'graphql';
import type { GraphQLField, GraphQLNamedType, GraphQLSchema } from 'graphql';
import { API_QUERY_LIMITS } from '../api/query-ast';

/**
 * What a GraphQL operation costs, measured on the document before it is executed.
 *
 * A query is a program a client writes, and nothing in the protocol bounds it: one round trip can
 * ask for a relation three levels deep over a page of a thousand rows, or the same expensive field
 * fifty times under fifty aliases, and the server discovers the price while paying it. The limit has
 * to be applied to the document, before a resolver runs, and it has to be predictable enough that an
 * honest client can reason about it.
 *
 * The model is therefore published rather than inferred: one point per scalar field, five per object
 * field, ten per connection field, each multiplied by the page the field's subtree will be fetched
 * for (capped at the page size the query protocol itself allows), and one point per argument. The
 * multiplier is what makes the model mean anything: a connection field is priced at ten *per row of
 * its page*, and every field selected underneath it — a scalar, an object, the next connection —
 * inherits that page size, because that is how many times each of them is produced. A page of a
 * hundred rows with three scalar fields and one relation with one child of its own therefore costs
 * `10 × 100 + 3 × 100 + 5 × 100 + 1 × 100 = 1900`, plus one point for the argument that asked for
 * the page. A list of objects that takes no page — a relation such as `tags` — is produced once per
 * element too, and is priced at the model's list fan-out per element.
 *
 * **What the document selects is what is priced** (SEC-C-01, SEC-C-02). A named fragment spread is
 * priced as the selections of the fragment it names — once per spread — and an inline fragment as its
 * own selections: neither is a field, and moving cost into a fragment does not hide it. With the
 * schema at hand, a connection is recognised by what the field RETURNS (a type named `…Connection`, or
 * one with `pageInfo`), because no field of the platform is named for it; the field-name suffix is the
 * fallback for a document measured without a schema. A page size stated through a variable is priced
 * at the cap, because a document is validated before its variables are known.
 *
 * The measurement reads the document's *shape* — `kind`, `name`, `arguments`, `selectionSet`,
 * `typeCondition` — which is exactly what an AST node carries, so it can be exercised on a fixed
 * document without building a schema.
 */

/** The parts of an AST node this model reads. */
export interface ISdlNode {
	kind?: string;
	name?: { value?: string };
	alias?: { value?: string };
	arguments?: Array<{ name?: { value?: string }; value?: unknown }>;
	selectionSet?: { selections?: ISdlNode[] };
	operation?: string;
	typeCondition?: { name?: { value?: string } };
	definitions?: ISdlNode[];
}

/** One field's cost class. */
export type FieldCostClass = 'scalar' | 'object' | 'connection';

/** The measured cost of one document. */
export interface IOperationCost {
	/** The deepest selection set, counting a root field as depth 1. */
	depth: number;
	/** How many fields are aliased. */
	aliases: number;
	/** The weighted cost, in the units the ceiling is expressed in. */
	complexity: number;
	/** How many fields the document selects, before any multiplier. */
	fields: number;
}

/** How the model prices a document. */
export interface ICostModelOptions {
	/** Points for a field that selects no children. */
	scalarCost?: number;
	/** Points for a field that selects children. */
	objectCost?: number;
	/** Points for a field that fetches a page, before the page is multiplied in. */
	connectionCost?: number;
	/** Points for passing one argument. */
	argumentCost?: number;
	/** The page size a connection's cost is multiplied by is capped here. */
	pageSizeCap?: number;
	/** The arguments that state a page size, in the order they are consulted. */
	pageSizeArguments?: string[];
	/** How a connection is recognised: the suffix of its return type's name (or of its name, without a schema). */
	connectionFieldSuffix?: string;
	/** The page size assumed when a connection states none. */
	defaultPageSize?: number;
	/** How many elements a list of objects that takes no page is priced for. */
	listFanOut?: number;
}

/** What a measurement may know beyond the document node it is handed. */
export interface IMeasureContext {
	/** The document's fragment definitions, by name: a spread is priced as what it selects. */
	fragments?: ReadonlyMap<string, ISdlNode> | Readonly<Record<string, ISdlNode>>;
	/** The schema: a connection is then recognised by its return type, and a list by its type. */
	schema?: GraphQLSchema;
}

/** The published model, as documented for clients. */
export const DEFAULT_COST_MODEL: Required<ICostModelOptions> = {
	scalarCost: 1,
	objectCost: 5,
	connectionCost: 10,
	argumentCost: 1,
	// The query protocol's own bounds: a page is never larger than the protocol serves, and a connection that states
	// none is served the protocol's default page — which is what it is priced for.
	pageSizeCap: API_QUERY_LIMITS.maxPageSize,
	pageSizeArguments: ['first', 'last', 'limit', 'take'],
	connectionFieldSuffix: 'Connection',
	defaultPageSize: API_QUERY_LIMITS.defaultPageSize,
	listFanOut: 10
};

/** The argument that carries the connection protocol's page as an object (`page: { first, last }`). */
const PAGE_OBJECT_ARGUMENT = 'page';

/** The fields that describe the schema rather than the data; the introspection policy governs them. */
const INTROSPECTION_ROOTS = new Set(['__schema', '__type']);

/**
 * Classifies a field by its shape.
 *
 * Without a schema the name is the only signal for "this fetches a page": a field named for it by the
 * convention is a connection, and a field with children that is not one is an object. With the schema
 * the return type decides — see {@link measureOperation}. A field with no children is a scalar, which
 * is what makes the model conservative rather than clever — it never prices a field lower than the
 * work it can cause.
 *
 * @param node The field node.
 * @param options The model.
 * @returns The field's class.
 */
export function classifyField(node: ISdlNode, options: Required<ICostModelOptions> = DEFAULT_COST_MODEL): FieldCostClass {
	if (!node?.selectionSet?.selections?.length) {
		return 'scalar';
	}

	const name = node.name?.value ?? '';

	return name.endsWith(options.connectionFieldSuffix) ? 'connection' : 'object';
}

/**
 * Reads the page size a connection field states.
 *
 * A literal is read as stated, clamped to the cap. A variable is priced at the cap: the document is
 * measured before its variables are known, and a ceiling that trusted the smallest possible value
 * would be a ceiling a client sets for itself. The page may be stated directly (`first`, `last`,
 * `limit`, `take`) or inside the protocol's `page` object.
 *
 * @param node The field node.
 * @param options The model.
 * @returns The page size, clamped to the model's cap.
 */
export function readPageSize(
	node: ISdlNode,
	options: Required<ICostModelOptions> = DEFAULT_COST_MODEL
): number {
	// Every page the field states is read and the LARGEST is priced. A field may state its page in more than one
	// place (`first` and `page: { first }`), and the resolver honours one of them by its own precedence; pricing the
	// first one found let `first: 1, page: { first: 100 }` cost one row and fetch a hundred (Greptile on #10651).
	const sizes: number[] = [];
	const collect = (argumentsOf: Array<{ name?: { value?: string }; value?: unknown }> | undefined): void => {
		for (const argumentName of options.pageSizeArguments) {
			const argument = argumentsOf?.find((candidate) => candidate?.name?.value === argumentName);
			const size = sizeOf(argument?.value, options);

			if (size !== undefined) {
				sizes.push(size);
			}
		}
	};

	collect(node?.arguments);

	const page = node?.arguments?.find((candidate) => candidate?.name?.value === PAGE_OBJECT_ARGUMENT)?.value as
		| { kind?: string; fields?: Array<{ name?: { value?: string }; value?: unknown }> }
		| undefined;
	if (page?.kind === 'Variable') {
		sizes.push(options.pageSizeCap);
	}
	collect(page?.fields);

	return sizes.length ? Math.max(...sizes) : Math.min(options.pageSizeCap, options.defaultPageSize);
}

/**
 * The page size one argument value states, or undefined when it states none.
 *
 * @param value The argument's AST value.
 * @param options The model.
 */
function sizeOf(value: unknown, options: Required<ICostModelOptions>): number | undefined {
	if (!value) {
		return undefined;
	}

	if ((value as { kind?: string }).kind === 'Variable') {
		return options.pageSizeCap;
	}

	const raw = (value as { value?: unknown })?.value;
	const size = typeof raw === 'number' ? raw : Number(String(raw));

	return Number.isFinite(size) && size > 0 ? Math.min(options.pageSizeCap, Math.floor(size)) : undefined;
}

/**
 * Measures one document.
 *
 * Every operation in the document is measured and the most expensive one is reported: a document
 * that carries several operations is executed once per operation, so the ceiling has to hold for
 * each of them, and the reported depth and cost are the worst case rather than the first case.
 *
 * Fragments are priced where they are spread. A whole `Document` carries its fragment definitions;
 * an operation handed in on its own is given them through `context.fragments` — which is what the
 * validation rules do with the document they validate. A fragment is measured once and its cost
 * reused at every spread, so a fragment spread a thousand times, or fragments that spread each other
 * in a chain, cost one walk each rather than an exponential one; a fragment that spreads itself
 * (invalid, and refused by the specified rules) contributes nothing at the cycle.
 *
 * @param document The parsed document, an operation, or any node with a selection set.
 * @param options The model to price with.
 * @param context The fragments and the schema, when the caller has them.
 * @returns The cost of the document's most expensive operation.
 */
export function measureOperation(
	document: ISdlNode | ISdlNode[],
	options: ICostModelOptions = {},
	context: IMeasureContext = {}
): IOperationCost {
	const model: Required<ICostModelOptions> = { ...DEFAULT_COST_MODEL, ...options };

	let roots: ISdlNode[];
	let fragments = context.fragments;

	if (!Array.isArray(document) && document?.kind === 'Document') {
		// A whole document: its operations are what is executed, its fragments are what they spread.
		roots = (document.definitions ?? []).filter((definition) => definition?.kind === 'OperationDefinition');
		fragments = fragments ?? fragmentsOf(document);
	} else if (!Array.isArray(document) && (document?.kind === 'OperationDefinition' || document?.kind === 'FragmentDefinition')) {
		// One operation — what the validation rules hand in — is one unit: its root fields are priced together on
		// the operation's root type. Splitting it into its root fields priced each one alone and reported the
		// dearest, so five hundred expensive root fields cost what one did.
		roots = [document];
	} else {
		roots = Array.isArray(document)
			? document
			: document?.selectionSet?.selections ?? (document ? [document] : []);
	}

	const walk = new CostWalk(model, toMap(fragments), context.schema);
	let worst: IOperationCost = { depth: 0, aliases: 0, complexity: 0, fields: 0 };

	for (const root of roots) {
		if (!root) {
			continue;
		}

		// A document's selections are operations, and an operation's selections are its root fields.
		// A bare field handed in on its own is measured as a root field, so the same function prices
		// a whole document and a single selection.
		const isOperation =
			root.kind === 'OperationDefinition' || root.kind === 'FragmentDefinition' || (!root.name && !!root.selectionSet);

		const measured = walk.selections(
			isOperation ? root.selectionSet?.selections : [root],
			1,
			walk.rootTypeOf(root, isOperation)
		);

		// Depth and cost are the worst case across the document's operations, because each of them is
		// executed; aliases and fields are summed, because they are what a single request asks the
		// server to produce whichever operation carries them.
		worst = {
			depth: Math.max(worst.depth, measured.depth),
			aliases: worst.aliases + measured.aliases,
			complexity: Math.max(worst.complexity, measured.scaled + measured.args),
			fields: worst.fields + measured.fields
		};
	}

	return worst;
}

/**
 * The fragment definitions of a document, by name.
 *
 * @param document The parsed document.
 * @returns The fragments it defines.
 */
export function fragmentsOf(document: ISdlNode | undefined): Map<string, ISdlNode> {
	const fragments = new Map<string, ISdlNode>();

	for (const definition of document?.definitions ?? []) {
		const name = definition?.name?.value;
		if (definition?.kind === 'FragmentDefinition' && name) {
			fragments.set(name, definition);
		}
	}

	return fragments;
}

/** A context's fragments as a map. */
function toMap(fragments: IMeasureContext['fragments']): ReadonlyMap<string, ISdlNode> {
	if (!fragments) {
		return new Map();
	}

	return fragments instanceof Map ? fragments : new Map(Object.entries(fragments));
}

/**
 * The cost of a set of selections, kept in two parts: the points that are produced once per row of the
 * pages above them (`scaled`) and the points that are stated once in the document whatever the rows
 * (`args`). Keeping them apart is what lets a fragment be measured once and priced at every spread:
 * the spread contributes the same two parts wherever it sits, and the pages above it multiply only
 * the first.
 */
interface IWalkCost {
	depth: number;
	aliases: number;
	fields: number;
	scaled: number;
	args: number;
}

/** One measurement's walk: the model, the document's fragments, and the fragments already priced. */
class CostWalk {
	private readonly priced = new Map<string, IWalkCost>();
	private readonly pricing = new Set<string>();

	constructor(
		private readonly model: Required<ICostModelOptions>,
		private readonly fragments: ReadonlyMap<string, ISdlNode>,
		private readonly schema?: GraphQLSchema
	) {}

	/** The type an operation's root fields are read from. */
	rootTypeOf(root: ISdlNode, isOperation: boolean): GraphQLNamedType | undefined {
		if (!this.schema || !isOperation) {
			return undefined;
		}

		if (root.kind === 'FragmentDefinition') {
			return this.typeNamed(root.typeCondition?.name?.value);
		}

		switch (root.operation) {
			case 'mutation':
				return this.schema.getMutationType() ?? undefined;
			case 'subscription':
				return this.schema.getSubscriptionType() ?? undefined;
			default:
				return this.schema.getQueryType() ?? undefined;
		}
	}

	/**
	 * Prices a set of sibling selections.
	 *
	 * @param selections The siblings: fields, fragment spreads and inline fragments.
	 * @param depth The depth the siblings sit at, counting a root field as 1.
	 * @param parentType The type the siblings are selected on, when the schema is known.
	 */
	selections(selections: ISdlNode[] | undefined, depth: number, parentType: GraphQLNamedType | undefined): IWalkCost {
		const total: IWalkCost = { depth: 0, aliases: 0, fields: 0, scaled: 0, args: 0 };

		for (const selection of selections ?? []) {
			if (!selection) {
				continue;
			}

			if (selection.kind === 'FragmentSpread') {
				const fragment = this.fragment(selection.name?.value);
				if (fragment) {
					// The fragment was measured with its first level at depth 1; spread here, that level is `depth`.
					this.add(total, fragment, fragment.depth ? depth - 1 + fragment.depth : 0);
				}
				continue;
			}

			if (selection.kind === 'InlineFragment') {
				const type = selection.typeCondition?.name?.value
					? this.typeNamed(selection.typeCondition.name.value)
					: parentType;
				const inline = this.selections(selection.selectionSet?.selections, depth, type);
				this.add(total, inline, inline.depth);
				continue;
			}

			this.add(total, this.field(selection, depth, parentType), undefined);
		}

		return total;
	}

	/** Prices one field and everything selected under it. */
	private field(selection: ISdlNode, depth: number, parentType: GraphQLNamedType | undefined): IWalkCost {
		// The schema's description of itself is not data: what `__schema` / `__type` answer is bounded by the schema,
		// and whether a deployment answers them at all is the introspection policy's decision, made by its own rule.
		// Priced like data, the standard introspection query — whose TypeRef fragment nests `ofType` by design — is 15
		// levels deep and costs over 11,000, and every GraphiQL and codegen client would be refused wherever the
		// schema is published.
		if (INTROSPECTION_ROOTS.has(selection.name?.value ?? '')) {
			return { depth: 0, aliases: 0, fields: 0, scaled: 0, args: 0 };
		}

		const definition = this.definitionOf(parentType, selection.name?.value);
		const hasChildren = !!selection.selectionSet?.selections?.length;
		const returned = definition ? getNamedType(definition.type) : undefined;

		const fieldClass: FieldCostClass = !hasChildren
			? 'scalar'
			: definition
				? this.isConnectionType(returned)
					? 'connection'
					: 'object'
				: classifyField(selection, this.model);

		// How many times the field's subtree is produced: the page a connection fetches, the elements of a
		// list of objects that takes no page — except the list a connection carries its page in, whose rows
		// the connection's page already counts.
		const pageFactor =
			fieldClass === 'connection'
				? readPageSize(selection, this.model)
				: fieldClass === 'object' && definition && isListType(getNullableType(definition.type)) && !this.isConnectionType(parentType)
					? this.model.listFanOut
					: 1;

		const base =
			fieldClass === 'connection'
				? this.model.connectionCost
				: fieldClass === 'object'
					? this.model.objectCost
					: this.model.scalarCost;

		const child = this.selections(selection.selectionSet?.selections, depth + 1, returned);

		return {
			depth: Math.max(depth, child.depth),
			aliases: (selection.alias?.value ? 1 : 0) + child.aliases,
			fields: 1 + child.fields,
			// A connection is priced per row of the page it fetches, and everything under it inherits that
			// page: selecting a relation over a hundred rows is a hundred selections, which is the cost a
			// limit has to see.
			scaled: base * pageFactor + pageFactor * child.scaled,
			// An argument is one point however many rows the field returns: it is stated once in the
			// document, so pricing it per row would price the client's typing rather than the work.
			args: (selection.arguments?.length ?? 0) * this.model.argumentCost + child.args
		};
	}

	/** A fragment's cost, measured once per walk; undefined for an unknown fragment or at a cycle. */
	private fragment(name: string | undefined): IWalkCost | undefined {
		if (!name) {
			return undefined;
		}

		const known = this.priced.get(name);
		if (known) {
			return known;
		}

		const definition = this.fragments.get(name);
		if (!definition || this.pricing.has(name)) {
			return undefined;
		}

		this.pricing.add(name);
		const measured = this.selections(
			definition.selectionSet?.selections,
			1,
			this.typeNamed(definition.typeCondition?.name?.value)
		);
		this.pricing.delete(name);
		this.priced.set(name, measured);

		return measured;
	}

	/** Adds one part to a running total; `depth`, when stated, replaces the part's own depth. */
	private add(total: IWalkCost, part: IWalkCost, depth: number | undefined): void {
		total.depth = Math.max(total.depth, depth ?? part.depth);
		total.aliases += part.aliases;
		total.fields += part.fields;
		total.scaled += part.scaled;
		total.args += part.args;
	}

	/** The schema's type by name, when there is a schema. */
	private typeNamed(name: string | undefined): GraphQLNamedType | undefined {
		return this.schema && name ? (this.schema.getType(name) ?? undefined) : undefined;
	}

	/** The definition of a field on a type, when the schema is known and the type has fields. */
	private definitionOf(type: GraphQLNamedType | undefined, name: string | undefined): GraphQLField<unknown, unknown> | undefined {
		if (!type || !name || !(isObjectType(type) || isInterfaceType(type))) {
			return undefined;
		}

		return type.getFields()[name];
	}

	/** Whether a type is a connection: named for it, or carrying the protocol's `pageInfo`. */
	private isConnectionType(type: GraphQLNamedType | undefined): boolean {
		if (!type) {
			return false;
		}

		if (type.name.endsWith(this.model.connectionFieldSuffix)) {
			return true;
		}

		return (isObjectType(type) || isInterfaceType(type)) && 'pageInfo' in type.getFields();
	}
}
