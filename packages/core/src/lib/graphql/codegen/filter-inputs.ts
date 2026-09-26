import { FilterOperator } from '../../api/query-ast';
import { FILTER_OPERATORS_BY_KIND, operatorsForKind } from '../../api/filter-parser';
import type { ApiQueryFieldKind, ApiQuerySchema } from '../../api/query-schema';

/**
 * Generation of the filter, sort and pagination inputs from a resource's query schema.
 *
 * The declaration is the only source. A field is filterable in GraphQL if and only if the schema
 * says so, the sort enum is the schema's sortable list, and a relation filter exists because the
 * schema declares a filterable path through that relation. Nothing here is written by hand, and
 * nothing is inferred from an entity, which is what makes the two API surfaces structurally unable
 * to drift: they are two renderings of one list.
 *
 * Two generated shapes are worth reading closely:
 *
 * - **A relation filter is one level deep, by construction.** A two-segment filterable path
 *   (`customer.name`) becomes a field of a generated relation type, and that type carries only
 *   scalar conditions. A three-segment path is therefore not rejected — it is unrepresentable,
 *   which is a stronger guarantee than a validation rule.
 * - **Operator availability is the shared input type's.** A `STRING` field references
 *   `StringFilter`, whose operator set is declared once for the platform; this module asserts that
 *   every operator that type offers is one the parser accepts for that kind, so the schema a client
 *   reads can never advertise an operator the server refuses.
 */

/** The generated file for one aspect of one resource. */
export interface GeneratedInputFile {
	/** The path the fragment belongs at, relative to the workspace root. */
	readonly path: string;
	/** The resource the fragment was generated from. */
	readonly resource: string;
	/** Which of the three fragments this is. */
	readonly kind: 'filter' | 'sort' | 'pagination';
	/** The GraphQL SDL. */
	readonly content: string;
}

/** The generated fragments of every resource, and anything the generator had to guess. */
export interface GeneratedInputs {
	/** One entry per resource per fragment, in the order the schemas were given. */
	readonly files: readonly GeneratedInputFile[];
	/** Diagnostics: a schema that declares a filterable field with no kind, for example. */
	readonly warnings: readonly string[];
}

/**
 * The operators the GraphQL surface offers for each kind.
 *
 * This is the projection rule: it decides which shared filter input a field references, and, for
 * the kinds the platform has no shared input for, which operators the generated input carries. It
 * is deliberately narrower than the parser for two kinds — a boolean is not meaningfully a member of
 * a list, and a date range is expressed with `between` — and {@link assertOperatorProjectionSupported}
 * refuses a projection that offers an operator the parser would reject.
 */
export const GRAPHQL_FILTER_OPERATORS: Readonly<Record<ApiQueryFieldKind, readonly FilterOperator[]>> = {
	STRING: ['eq', 'ne', 'in', 'nin', 'like', 'ilike', 'isNull', 'contains'],
	NUMBER: ['eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull'],
	DECIMAL: ['eq', 'ne', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull'],
	DATE: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull'],
	ENUM: ['eq', 'ne', 'in', 'nin', 'isNull'],
	ID: ['eq', 'ne', 'in', 'nin', 'isNull'],
	BOOLEAN: ['eq', 'ne', 'isNull'],
	JSON: ['contains', 'isNull']
};

/**
 * The shared filter input a kind references, where the platform declares one.
 *
 * `ENUM` is absent because the generator cannot know an enum's values, and `JSON` is declared
 * because structured containment is the same question whatever the document holds; both are
 * explained where they are used.
 */
const SHARED_FILTER_INPUT_BY_KIND: Readonly<Partial<Record<ApiQueryFieldKind, string>>> = {
	ID: 'IDFilter',
	STRING: 'StringFilter',
	NUMBER: 'NumberFilter',
	DECIMAL: 'DecimalFilter',
	BOOLEAN: 'BooleanFilter',
	DATE: 'DateTimeFilter',
	JSON: 'JSONFilter'
};

/** The kind assumed for a filterable field the schema does not classify. */
const ASSUMED_KIND: ApiQueryFieldKind = 'STRING';

/** The directory the generated fragments are committed in, relative to the workspace root. */
export const GENERATED_INPUT_DIRECTORY = 'packages/core/src/lib/graphql/schema';

/** Refuses a projection that offers an operator the parser does not accept for that kind. */
export function assertOperatorProjectionSupported(): void {
	for (const [kind, operators] of Object.entries(GRAPHQL_FILTER_OPERATORS) as Array<
		[ApiQueryFieldKind, readonly FilterOperator[]]
	>) {
		const accepted = operatorsForKind(kind);
		for (const operator of operators) {
			if (!accepted.includes(operator)) {
				throw new Error(
					`The GraphQL projection offers "${operator}" for ${kind}, which the query protocol does not accept ` +
						`for that kind (${FILTER_OPERATORS_BY_KIND[kind].join(', ')}). A generated input must never ` +
						'advertise an operator the server refuses.'
				);
			}
		}
	}
}

/** `order` → `Order`; `paymentMethodToken` → `PaymentMethodToken`; `order_line` → `OrderLine`. */
export function pascalCase(value: string): string {
	return value
		.split(/[^A-Za-z0-9]+/)
		.filter((segment) => segment.length > 0)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join('');
}

/** `createdAt` → `CREATED_AT`; `customer.name` → `CUSTOMER_NAME`. */
export function upperSnakeCase(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.replace(/[^A-Za-z0-9]+/g, '_')
		.toUpperCase();
}

/** `paymentMethodToken` → `payment-method-token`; the file name a fragment is written to. */
export function kebabCase(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/[^A-Za-z0-9]+/g, '-')
		.toLowerCase();
}

/** One scalar condition field of a generated filter input. */
interface GeneratedFilterField {
	readonly name: string;
	/** The GraphQL type of the field. */
	readonly type: string;
}

/** A generated relation filter input, and the resource path it stands for. */
interface GeneratedRelationFilter {
	readonly type: string;
	readonly relation: string;
	readonly fields: readonly GeneratedFilterField[];
}

/** A generated enum filter input, named after the field it filters. */
interface GeneratedEnumFilter {
	readonly type: string;
	readonly field: string;
	readonly operators: readonly FilterOperator[];
}

/** The generated filter input of one resource. */
export interface GeneratedFilterInput {
	readonly resource: string;
	readonly type: string;
	readonly fields: readonly GeneratedFilterField[];
	readonly relations: readonly GeneratedRelationFilter[];
	readonly enums: readonly GeneratedEnumFilter[];
	readonly warnings: readonly string[];
}

/** Splits a filterable entry into its path segments. */
function segmentsOf(path: string): string[] {
	return path.split('.').filter((segment) => segment.length > 0);
}

/**
 * Describes a resource's filter input.
 *
 * Separating the description from the rendering is what lets the parity assertion reason about the
 * generated input as data — the set of fields, the relations, the enum inputs — instead of parsing
 * the SDL back out of a string.
 *
 * @param schema The resource's declaration.
 * @returns The description, with a warning for every filterable field the schema does not classify.
 */
export function buildFilterInput(schema: ApiQuerySchema): GeneratedFilterInput {
	const resource = pascalCase(schema.resource);
	const warnings: string[] = [];
	const fields: GeneratedFilterField[] = [];
	const enums = new Map<string, GeneratedEnumFilter>();
	const relations = new Map<string, { type: string; relation: string; fields: GeneratedFilterField[] }>();

	for (const entry of schema.filterable ?? []) {
		const segments = segmentsOf(entry);
		if (segments.length === 0) {
			continue;
		}

		const declaredKind = schema.kinds?.[entry];
		if (!declaredKind) {
			// A generated input is never omitted silently: the field is emitted as text, and the
			// resource is told it did not classify it.
			warnings.push(
				`"${schema.resource}.${entry}" is filterable but declares no kind; it was generated as ${ASSUMED_KIND}.`
			);
		}
		const kind = declaredKind ?? ASSUMED_KIND;
		const graphqlType = filterFieldType(schema, segments, kind, enums);

		if (segments.length === 1) {
			fields.push({ name: segments[0], type: graphqlType });
			continue;
		}

		// A two-segment path becomes a field of a generated relation type, one level deep. A longer
		// path is refused here rather than generated, because the filter grammar cannot express it and
		// a type that could would be a type the server would have to reject at runtime.
		if (segments.length > 2) {
			throw new Error(
				`"${schema.resource}.${entry}" filters through ${segments.length} path segments; the query protocol ` +
					'expresses at most two, and a generated relation filter is one level deep by construction.'
			);
		}
		const relation = segments[0];
		const existing = relations.get(relation) ?? {
			type: `${resource}${pascalCase(relation)}RelationFilter`,
			relation,
			fields: []
		};
		existing.fields.push({ name: segments[1], type: graphqlType });
		relations.set(relation, existing);
	}

	return {
		resource: schema.resource,
		type: `${resource}Filter`,
		fields,
		relations: Array.from(relations.values()),
		enums: Array.from(enums.values()),
		warnings
	};
}

/** The GraphQL type of one filterable field, registering a generated enum input when needed. */
function filterFieldType(
	schema: ApiQuerySchema,
	segments: readonly string[],
	kind: ApiQueryFieldKind,
	enums: Map<string, GeneratedEnumFilter>
): string {
	const shared = SHARED_FILTER_INPUT_BY_KIND[kind];
	if (shared) {
		return shared;
	}
	// An enum is the one kind the platform cannot declare a shared input for: the values belong to
	// the domain. The generated input is named after the resource and the field, takes the enum's
	// wire value as text — which is what a caller filters by on both surfaces — and carries exactly
	// the operators the projection allows for an enum.
	const type = `${pascalCase(schema.resource)}${pascalCase(segments.join('_'))}Filter`;
	if (!enums.has(type)) {
		enums.set(type, { type, field: segments.join('.'), operators: GRAPHQL_FILTER_OPERATORS.ENUM });
	}
	return type;
}

/** Renders a GraphQL description block. */
function description(lines: readonly string[]): string {
	return ['"""', ...lines, '"""'].join('\n');
}

/**
 * Renders a resource's filter fragment.
 *
 * @param model The description.
 * @returns The SDL.
 */
export function renderFilterInput(model: GeneratedFilterInput): string {
	const lines: string[] = [
		`# Generated from the "${model.resource}" query schema. Do not edit by hand.`,
		'# Regenerate with: nx run core:graphql-inputs',
		''
	];

	for (const enumFilter of model.enums) {
		lines.push(
			description([
				`Conditions on the "${enumFilter.field}" field of \`${model.resource}\`.`,
				'Values are the wire values the field is written with, so an enum is filtered by the same text on both surfaces.'
			])
		);
		lines.push(`input ${enumFilter.type} {`);
		for (const operator of enumFilter.operators) {
			lines.push(`\t${operator}: ${operatorType(operator)}`);
		}
		lines.push('}', '');
	}

	for (const relation of model.relations) {
		lines.push(
			description([
				`Conditions on \`${model.resource}.${relation.relation}\`.`,
				'One level deep: a path through this relation to a further relation is not expressible.'
			])
		);
		lines.push(`input ${relation.type} {`);
		for (const field of relation.fields) {
			lines.push(`\t${field.name}: ${field.type}`);
		}
		lines.push('}', '');
	}

	lines.push(
		description([
			`Filter conditions for \`${model.resource}\`.`,
			'A field is present here if and only if the query schema declares it filterable, and the operators of each field follow its declared kind.'
		])
	);
	lines.push(`input ${model.type} {`);
	for (const field of model.fields) {
		lines.push(`\t${field.name}: ${field.type}`);
	}
	for (const relation of model.relations) {
		lines.push(`\t${relation.relation}: ${relation.type}`);
	}
	lines.push('\tand: [' + model.type + '!]');
	lines.push('\tor: [' + model.type + '!]');
	lines.push('\tnot: ' + model.type);
	lines.push('}', '');

	return lines.join('\n');
}

/** The GraphQL type an operator's value takes in a generated enum input. */
function operatorType(operator: FilterOperator): string {
	switch (operator) {
		case 'in':
		case 'nin':
			return '[String!]';
		case 'isNull':
			return 'Boolean';
		default:
			return 'String';
	}
}

/** The generated sort input of one resource. */
export interface GeneratedSortInput {
	readonly resource: string;
	readonly enumType: string;
	readonly type: string;
	readonly values: readonly { readonly name: string; readonly field: string }[];
	readonly defaultSort: readonly string[];
}

/**
 * Describes a resource's sort input.
 *
 * @param schema The resource's declaration.
 * @returns The description.
 */
export function buildSortInput(schema: ApiQuerySchema): GeneratedSortInput {
	return {
		resource: schema.resource,
		enumType: `${pascalCase(schema.resource)}SortField`,
		type: `${pascalCase(schema.resource)}Sort`,
		values: (schema.sortable ?? []).map((field) => ({ name: upperSnakeCase(field), field })),
		defaultSort: [...(schema.defaultSort ?? [])]
	};
}

/**
 * Renders a resource's sort fragment.
 *
 * The default sort is documented rather than encoded: an input default would silently reorder a
 * query the caller did not ask to reorder, and the effective sort has to be visible to whoever reads
 * the schema and to whatever mints a cursor under it.
 *
 * @param model The description.
 * @returns The SDL.
 */
export function renderSortInput(model: GeneratedSortInput): string {
	const lines: string[] = [
		`# Generated from the "${model.resource}" query schema. Do not edit by hand.`,
		'# Regenerate with: nx run core:graphql-inputs',
		''
	];

	lines.push(
		description([
			`Sortable fields of \`${model.resource}\`, generated from the resource's query schema.`,
			model.defaultSort.length > 0
				? `Default sort: ${model.defaultSort.join(', ')}. Applied when a query asks to sort by nothing, and the order a cursor is minted under.`
				: 'This resource declares no default sort, so an unsorted query has no defined order and cursor pagination is unavailable.'
		])
	);
	lines.push(`enum ${model.enumType} {`);
	for (const value of model.values) {
		// The description names the field the value stands for, so the mapping survives a rename and a
		// field whose name contains a separator is unambiguous.
		lines.push(`\t"${value.field}"`);
		lines.push(`\t${value.name}`);
	}
	lines.push('}', '');
	lines.push(`input ${model.type} {`);
	lines.push(`\tfield: ${model.enumType}!`);
	lines.push('\tdirection: SortDirection!');
	lines.push('}', '');

	return lines.join('\n');
}

/** The generated pagination input of one resource. */
export interface GeneratedPaginationInput {
	readonly resource: string;
	readonly type: string;
	readonly defaultPageSize: number;
	readonly maxPageSize: number;
	readonly defaultSort: readonly string[];
	/** Whether the resource can be cursor-paginated at all. */
	readonly cursor: boolean;
}

/**
 * Describes a resource's pagination input.
 *
 * @param schema The resource's declaration.
 * @param limits The platform's page-size limits, resolved by the caller so the two surfaces read one
 *   table.
 * @returns The description.
 */
export function buildPaginationInput(
	schema: ApiQuerySchema,
	limits: { readonly defaultPageSize: number; readonly maxPageSize: number }
): GeneratedPaginationInput {
	return {
		resource: schema.resource,
		type: `${pascalCase(schema.resource)}PageInput`,
		defaultPageSize: Math.min(schema.defaultPageSize && schema.defaultPageSize > 0 ? schema.defaultPageSize : limits.defaultPageSize, schema.maxPageSize && schema.maxPageSize > 0 ? Math.min(schema.maxPageSize, limits.maxPageSize) : limits.maxPageSize),
		maxPageSize: schema.maxPageSize && schema.maxPageSize > 0 ? Math.min(schema.maxPageSize, limits.maxPageSize) : limits.maxPageSize,
		defaultSort: [...(schema.defaultSort ?? [])],
		cursor: (schema.defaultSort ?? []).length > 0
	};
}

/**
 * Renders a resource's pagination fragment.
 *
 * The cursor arguments are generated only for a resource that declares a default sort, because a
 * cursor names a position in an order and a resource without one has no order to name a position
 * in. That makes the rule structural on this surface rather than a validation the caller only meets
 * at runtime.
 *
 * @param model The description.
 * @returns The SDL.
 */
export function renderPaginationInput(model: GeneratedPaginationInput): string {
	const lines: string[] = [
		`# Generated from the "${model.resource}" query schema. Do not edit by hand.`,
		'# Regenerate with: nx run core:graphql-inputs',
		''
	];

	lines.push(
		description([
			`Pagination for \`${model.resource}\`.`,
			`Default page size ${model.defaultPageSize}, maximum ${model.maxPageSize}.`,
			model.cursor
				? `Cursor pagination is available; the default sort it walks is ${model.defaultSort.join(', ')}.`
				: 'Cursor pagination is unavailable because the resource declares no default sort.'
		])
	);
	lines.push(`input ${model.type} {`);
	if (model.cursor) {
		lines.push(`\tfirst: Int = ${model.defaultPageSize}`);
		lines.push('\tafter: String');
		lines.push('\tlast: Int');
		lines.push('\tbefore: String');
	}
	lines.push(`\tlimit: Int = ${model.defaultPageSize}`);
	lines.push('\toffset: Int');
	lines.push('}', '');

	return lines.join('\n');
}

/**
 * The resource's fragments, in the order they should be written.
 *
 * @param schema The resource's declaration.
 * @param limits The platform's page-size limits.
 * @param directory The directory the fragments are committed in.
 * @returns One entry per fragment, plus the warnings the filter input produced.
 */
export function generateResourceInputs(
	schema: ApiQuerySchema,
	limits: { readonly defaultPageSize: number; readonly maxPageSize: number },
	directory: string = GENERATED_INPUT_DIRECTORY
): { files: GeneratedInputFile[]; warnings: string[] } {
	const filter = buildFilterInput(schema);
	const sort = buildSortInput(schema);
	const pagination = buildPaginationInput(schema, limits);
	const fileBase = `${directory.replace(/\/+$/, '')}/${kebabCase(schema.resource)}`;

	return {
		files: [
			{ path: `${fileBase}.filter.gql`, resource: schema.resource, kind: 'filter', content: renderFilterInput(filter) },
			{ path: `${fileBase}.sort.gql`, resource: schema.resource, kind: 'sort', content: renderSortInput(sort) },
			{
				path: `${fileBase}.pagination.gql`,
				resource: schema.resource,
				kind: 'pagination',
				content: renderPaginationInput(pagination)
			}
		],
		warnings: [...filter.warnings]
	};
}

/** The type names one resource's fragments declare. */
export function declaredInputTypeNames(schema: ApiQuerySchema): string[] {
	const filter = buildFilterInput(schema);
	const sort = buildSortInput(schema);
	const pagination = buildPaginationInput(schema, { defaultPageSize: 0, maxPageSize: 0 });
	return [
		filter.type,
		...filter.relations.map((relation) => relation.type),
		...filter.enums.map((enumFilter) => enumFilter.type),
		sort.enumType,
		sort.type,
		pagination.type
	];
}

/**
 * Refuses two resources that would generate the same input type.
 *
 * A collision would make the printed schema depend on which file the loader read first, and the
 * symptom would be a schema that describes one resource's fields under another resource's name.
 * Naming both resources is what makes it a five-second fix.
 *
 * @param schemas The declarations being generated.
 * @throws Error naming both resources when a type name is claimed twice.
 */
export function assertUniqueInputTypeNames(schemas: readonly ApiQuerySchema[]): void {
	const owner = new Map<string, string>();
	for (const schema of schemas) {
		for (const name of declaredInputTypeNames(schema)) {
			const existing = owner.get(name);
			if (existing && existing !== schema.resource) {
				throw new Error(
					`The query schemas "${existing}" and "${schema.resource}" both generate the input type "${name}". ` +
						'Two resources cannot share a generated type name; rename one of them.'
				);
			}
			if (existing === schema.resource && name !== `${pascalCase(schema.resource)}Filter`) {
				throw new Error(
					`The query schema "${schema.resource}" generates the input type "${name}" more than once. ` +
						'Two fields of one resource cannot share a generated type name.'
				);
			}
			owner.set(name, schema.resource);
		}
	}
}

/** The two sets a parity check compares, or the reason they differ. */
export interface InputParityViolation {
	/** What was compared. */
	readonly aspect: 'filterable' | 'sortable' | 'relations';
	/** Entries the declaration has and the generated input does not. */
	readonly missing: readonly string[];
	/** Entries the generated input has and the declaration does not. */
	readonly unexpected: readonly string[];
}

/**
 * Compares a resource's generated inputs with the declaration they came from.
 *
 * The comparison runs in both directions on purpose. One direction catches a generator that lost a
 * field; the other catches a generator that invented one, which is the failure that turns a
 * generated schema into a second, unmaintained copy of the declaration. The contract gate calls
 * this, and so does the generator, so a disagreement is reported before anything is written.
 *
 * @param schema The resource's declaration.
 * @returns One entry per aspect that disagrees; empty when the two agree.
 */
export function collectInputParityViolations(schema: ApiQuerySchema): InputParityViolation[] {
	const filter = buildFilterInput(schema);
	const sort = buildSortInput(schema);
	const violations: InputParityViolation[] = [];

	// A dotted filterable path renders as a relation field plus a field of the relation's own type,
	// so the comparison is made on the paths, which is the level the declaration speaks at.
	const generatedFilterPaths = [
		...filter.fields.map((field) => field.name),
		...filter.relations.flatMap((relation) => relation.fields.map((field) => `${relation.relation}.${field.name}`))
	];
	violations.push({
		aspect: 'filterable',
		missing: (schema.filterable ?? []).filter((entry) => !generatedFilterPaths.includes(entry)),
		unexpected: generatedFilterPaths.filter((entry) => !(schema.filterable ?? []).includes(entry))
	});

	const generatedSortFields = sort.values.map((value) => value.field);
	violations.push({
		aspect: 'sortable',
		missing: (schema.sortable ?? []).filter((entry) => !generatedSortFields.includes(entry)),
		unexpected: generatedSortFields.filter((entry) => !(schema.sortable ?? []).includes(entry))
	});

	// A relation filter exists exactly for the relations a filterable path passes through. The
	// declaration's expandable list is what those relations may be expanded as, so a filter that
	// reaches through a relation the resource does not expand is a declaration mistake rather than a
	// generator one — and saying so is the point of checking.
	const generatedRelations = filter.relations.map((relation) => relation.relation);
	violations.push({
		aspect: 'relations',
		missing: generatedRelations.filter((relation) => !(schema.expandable ?? []).includes(relation)),
		unexpected: []
	});

	return violations
		.map((violation) => ({
			...violation,
			missing: violation.missing.filter((entry, index) => violation.missing.indexOf(entry) === index),
			unexpected: violation.unexpected.filter((entry, index) => violation.unexpected.indexOf(entry) === index)
		}))
		.filter((violation) => violation.missing.length > 0 || violation.unexpected.length > 0);
}

/**
 * Refuses a resource whose generated inputs do not match its declaration.
 *
 * @param schema The resource's declaration.
 * @throws Error naming every disagreement.
 */
export function assertGeneratedInputParity(schema: ApiQuerySchema): void {
	const violations = collectInputParityViolations(schema);
	if (violations.length === 0) {
		return;
	}
	const detail = violations
		.map((violation) => {
			const parts: string[] = [];
			if (violation.missing.length > 0) {
				parts.push(`declared but not generated: ${violation.missing.join(', ')}`);
			}
			if (violation.unexpected.length > 0) {
				parts.push(`generated but not declared: ${violation.unexpected.join(', ')}`);
			}
			return `${violation.aspect} (${parts.join('; ')})`;
		})
		.join('; ');
	throw new Error(`The generated inputs for "${schema.resource}" do not match its declaration: ${detail}.`);
}

/**
 * Writes the generated fragments to disk.
 *
 * The command is the one the generation target runs. It writes into the directory the fragments are
 * committed in, and it is the only place in this module that touches the filesystem — everything
 * above is a pure function of the declarations, which is what lets a test assert the generated text
 * without a disk.
 *
 * A resource's fragments belong in exactly one directory. Two copies of one resource's filter input
 * would be merged into the same schema and the loader would refuse the redefinition, so the command
 * refuses to write a fragment that already exists under another path in the same run.
 */
async function main(): Promise<void> {
	const fs = await import('fs');
	const path = await import('path');
	// Imported here rather than at the top of the module: the registry reaches the plugin package,
	// and keeping it out of the module body is what lets the generator be imported and asserted
	// without a plugin configuration present.
	const { collectApiQuerySchemas } = await import('../../api/query-schema.registry');
	const { generateGraphqlInputs } = await import('./index');

	const schemas = collectApiQuerySchemas();
	const workspaceRoot = path.resolve(__dirname, '../../../../../..');
	const generated = generateGraphqlInputs(schemas);

	for (const warning of generated.warnings) {
		console.warn(`[graphql-inputs] ${warning}`);
	}

	if (generated.files.length === 0) {
		console.log('[graphql-inputs] no resource declares a query schema; nothing to generate.');
		return;
	}

	for (const file of generated.files) {
		const target = path.join(workspaceRoot, file.path);
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, file.content, 'utf8');
		console.log(`[graphql-inputs] wrote ${file.path}`);
	}
}

/* istanbul ignore next -- the command only runs when this file is the entry point. */
if (require.main === module) {
	void main().catch((error) => {
		console.error(`[graphql-inputs] ${(error as Error).message}`);
		process.exitCode = 1;
	});
}

