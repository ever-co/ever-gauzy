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
 * the page.
 *
 * The measurement is written against the document's *shape* rather than against the `graphql`
 * package's node types: it reads `kind`, `name`, `arguments` and `selectionSet`, which is exactly
 * what an AST node carries, so it can be exercised on a fixed document without building a schema.
 */

/** The parts of an AST node this model reads. */
export interface ISdlNode {
	kind?: string;
	name?: { value?: string };
	alias?: { value?: string };
	arguments?: Array<{ name?: { value?: string }; value?: unknown }>;
	selectionSet?: { selections?: ISdlNode[] };
	operation?: string;
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
	/** How a connection field is recognised without a schema. */
	connectionFieldSuffix?: string;
	/** The page size assumed when a connection states none. */
	defaultPageSize?: number;
}

/** The published model, as documented for clients. */
export const DEFAULT_COST_MODEL: Required<ICostModelOptions> = {
	scalarCost: 1,
	objectCost: 5,
	connectionCost: 10,
	argumentCost: 1,
	pageSizeCap: 100,
	pageSizeArguments: ['first', 'last', 'limit', 'take'],
	connectionFieldSuffix: 'Connection',
	defaultPageSize: 10
};

/**
 * Classifies a field by its shape.
 *
 * Without a schema the name is the only signal for "this fetches a page": a connection field is
 * named for it by the platform's own convention, and a field with children that is not one is an
 * object. A field with no children is a scalar, which is what makes the model conservative rather
 * than clever — it never prices a field lower than the work it can cause.
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
 * @param node The field node.
 * @param options The model.
 * @returns The page size, clamped to the model's cap.
 */
export function readPageSize(
	node: ISdlNode,
	options: Required<ICostModelOptions> = DEFAULT_COST_MODEL
): number {
	for (const argumentName of options.pageSizeArguments) {
		const argument = node?.arguments?.find((candidate) => candidate?.name?.value === argumentName);

		if (!argument) {
			continue;
		}

		const raw = (argument.value as { value?: unknown })?.value;
		const size = typeof raw === 'number' ? raw : Number(String(raw));

		if (Number.isFinite(size) && size > 0) {
			return Math.min(options.pageSizeCap, Math.floor(size));
		}
	}

	return Math.min(options.pageSizeCap, options.defaultPageSize);
}

/**
 * Measures one document.
 *
 * Every operation in the document is measured and the most expensive one is reported: a document
 * that carries several operations is executed once per operation, so the ceiling has to hold for
 * each of them, and the reported depth and cost are the worst case rather than the first case.
 *
 * Fragment spreads are priced as object fields and are not expanded. Resolving them would mean
 * carrying the document's fragment definitions through the walk, and the limit is a ceiling on what
 * a client may ask for — under-counting a fragment would make the ceiling a lie in exactly the case
 * a client is trying to hide cost.
 *
 * @param document The parsed document, or any node with a selection set.
 * @param options The model to price with.
 * @returns The cost of the document's most expensive operation.
 */
export function measureOperation(
	document: ISdlNode | ISdlNode[],
	options: ICostModelOptions = {}
): IOperationCost {
	const model: Required<ICostModelOptions> = { ...DEFAULT_COST_MODEL, ...options };
	const roots = Array.isArray(document)
		? document
		: document?.selectionSet?.selections ?? (document ? [document] : []);

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

		const measured = measureFields(
			isOperation ? root.selectionSet?.selections : [root],
			1,
			1,
			model
		);

		// Depth and cost are the worst case across the document's operations, because each of them is
		// executed; aliases and fields are summed, because they are what a single request asks the
		// server to produce whichever operation carries them.
		worst = {
			depth: Math.max(worst.depth, measured.depth),
			aliases: worst.aliases + measured.aliases,
			complexity: Math.max(worst.complexity, measured.complexity),
			fields: worst.fields + measured.fields
		};
	}

	return worst;
}

/**
 * Prices a set of sibling fields.
 *
 * The multiplier is how many times the fields are produced: one at the root, and the page size of
 * the connection they sit under anywhere below one. A connection raises it for everything beneath
 * it, including nested connections, which is what makes the model follow the work rather than the
 * syntax.
 *
 * @param selections The sibling fields.
 * @param depth The depth the siblings sit at, counting a root field as 1.
 * @param multiplier How many times these fields are produced.
 * @param model The model to price with.
 * @returns The cost of the siblings and everything below them.
 */
function measureFields(
	selections: ISdlNode[] | undefined,
	depth: number,
	multiplier: number,
	model: Required<ICostModelOptions>
): IOperationCost {
	let complexity = 0;
	let fields = 0;
	let aliases = 0;
	let maxDepth = 0;

	for (const selection of selections ?? []) {
		if (!selection) {
			continue;
		}

		fields += 1;

		if (selection.alias?.value) {
			aliases += 1;
		}

		const fieldClass = classifyField(selection, model);
		const base =
			fieldClass === 'connection'
				? model.connectionCost
				: fieldClass === 'object'
					? model.objectCost
					: model.scalarCost;

		// A connection is priced per row of the page it fetches, and everything under it inherits
		// that page: selecting a relation over a hundred rows is a hundred selections, which is the
		// cost a limit has to see.
		const childMultiplier = fieldClass === 'connection' ? multiplier * readPageSize(selection, model) : multiplier;

		complexity += base * childMultiplier;
		// An argument is one point however many rows the field returns: it is stated once in the
		// document, so pricing it per row would price the client's typing rather than the work.
		complexity += (selection.arguments?.length ?? 0) * model.argumentCost;
		maxDepth = Math.max(maxDepth, depth);

		const child = measureFields(selection.selectionSet?.selections, depth + 1, childMultiplier, model);

		complexity += child.complexity;
		aliases += child.aliases;
		fields += child.fields;
		maxDepth = Math.max(maxDepth, child.depth);
	}

	return { depth: maxDepth, aliases, complexity, fields };
}
