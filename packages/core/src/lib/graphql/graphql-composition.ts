import {
	DefinitionNode,
	DocumentNode,
	GraphQLArgument,
	GraphQLEnumType,
	GraphQLField,
	GraphQLInputField,
	GraphQLInputObjectType,
	GraphQLInterfaceType,
	GraphQLNamedType,
	GraphQLObjectType,
	GraphQLSchema,
	GraphQLUnionType,
	GraphQLError,
	Kind,
	buildASTSchema,
	parse,
	printSchema,
	validateSchema,
	visit
} from 'graphql';

/**
 * The composition pass.
 *
 * The schema is schema-first: every `.gql` file the loader globs is concatenated, `buildSchema` turns
 * the result into the core schema, and each plugin's SDL is then applied with `extendSchema`. Two
 * things can go wrong in that pipeline, and both of them are invisible until a request arrives:
 *
 * - two sources declare the same type or the same root field, which `buildSchema` reports as a
 *   duplicate definition without saying which of the platform's files is at fault;
 * - a domain redeclares a kernel type instead of referencing it, which succeeds as long as the two
 *   declarations happen to agree today and silently diverges the moment one of them is edited.
 *
 * This module answers both questions over the assembled schema and over the SDL files themselves, so
 * a collision fails the boot with a message naming the type and the field, and the SDL-level rule
 * ("the kernel types exist exactly once, in the kernel files") can be asserted by a plain node
 * process with no Nest container, no database and no configuration.
 */

/**
 * The root operation types. Declared once, by the kernel, and extended by every domain.
 */
export const GRAPHQL_ROOT_TYPE_NAMES: readonly string[] = ['Query', 'Mutation', 'Subscription'];

/**
 * The kernel SDL files, relative to the kernel directory.
 */
export const GRAPHQL_KERNEL_SDL_FILES: readonly string[] = [
	'common.type.gql',
	'pagination.type.gql',
	'filter.type.gql',
	'error.type.gql'
];

/**
 * Which kernel file declares which kernel type.
 *
 * This map is the assertion's source of truth: a type listed here must be declared exactly once
 * across the whole platform, and it must be declared by the file named here. Everything else in the
 * schema is a domain type, which may be declared by any domain but only once.
 */
export const GRAPHQL_KERNEL_TYPE_FILES: Readonly<Record<string, string>> = {
	// common.type.gql
	Query: 'common.type.gql',
	Mutation: 'common.type.gql',
	Subscription: 'common.type.gql',
	EventEnvelope: 'common.type.gql',
	EventAggregate: 'common.type.gql',
	PageInfo: 'common.type.gql',
	UserError: 'common.type.gql',
	Operation: 'common.type.gql',
	OperationStep: 'common.type.gql',
	OperationStatus: 'common.type.gql',
	OperationStepStatus: 'common.type.gql',
	DateTime: 'common.type.gql',
	Decimal: 'common.type.gql',
	JSON: 'common.type.gql',
	// pagination.type.gql
	PageInput: 'pagination.type.gql',
	SortDirection: 'pagination.type.gql',
	// filter.type.gql
	IDFilter: 'filter.type.gql',
	StringFilter: 'filter.type.gql',
	NumberFilter: 'filter.type.gql',
	DecimalFilter: 'filter.type.gql',
	BooleanFilter: 'filter.type.gql',
	DateTimeFilter: 'filter.type.gql',
	JSONFilter: 'filter.type.gql',
	TenantFilter: 'filter.type.gql'
	// error.type.gql declares no type on purpose: the error contract travels in `extensions`.
};

/**
 * Every kernel type name.
 */
export const GRAPHQL_KERNEL_TYPE_NAMES: readonly string[] = Object.keys(GRAPHQL_KERNEL_TYPE_FILES);

/**
 * Names a domain may never take.
 *
 * A reserved name that is a kernel type (the three root types, `PageInfo`, `PageInput`, `UserError`)
 * is owned by the kernel and is caught by the kernel-ownership rule. The names below are reserved
 * *in addition*: they are generic enough that a domain claiming one would make the schema
 * unreadable, and the documented answer is a qualified field name rather than a second type.
 */
export const GRAPHQL_RESERVED_TYPE_NAMES: readonly string[] = [
	'Node',
	'Edge',
	'Filter',
	'Sort',
	'Error',
	'MutationPayload',
	'Connection'
];

/**
 * Type names a package prefix must never appear on. A concept type is named for the concept.
 */
export const GRAPHQL_FORBIDDEN_TYPE_PREFIXES: readonly string[] = ['Commerce'];

/**
 * Scalars the specification defines, so a reference to one is not an unknown type.
 */
export const GRAPHQL_BUILT_IN_TYPE_NAMES: readonly string[] = ['Int', 'Float', 'String', 'Boolean', 'ID'];

/**
 * What a problem is about. Stable strings, so a CI gate can allow-list one rule without allowing the
 * others.
 */
export type CompositionRule =
	| 'unparseable-sdl'
	| 'missing-kernel-type'
	| 'kernel-type-redeclared'
	| 'duplicate-type'
	| 'root-type-redeclared'
	| 'root-field-collision'
	| 'reserved-name'
	| 'domain-prefixed-name'
	| 'unknown-type'
	| 'deprecation-without-reason'
	| 'plugin-type-redeclared'
	| 'plugin-field-redeclared'
	| 'invalid-schema'
	| 'orphan-type';

/**
 * One thing the pass found.
 */
export interface GraphqlCompositionProblem {
	readonly rule: CompositionRule;
	readonly message: string;
	readonly file?: string;
	readonly type?: string;
	readonly field?: string;
}

/**
 * The result of a pass. `errors` fail a boot; `warnings` are reported and never fatal.
 */
export interface GraphqlCompositionReport {
	readonly errors: readonly GraphqlCompositionProblem[];
	readonly warnings: readonly GraphqlCompositionProblem[];
	readonly counts: {
		readonly files: number;
		readonly types: number;
		readonly rootFields: number;
		/**
		 * Kernel types nothing in this schema references yet. Expected while a kernel capability has
		 * no domain using it, which is why it is a count rather than a problem.
		 */
		readonly unusedKernelTypes: readonly string[];
	};
}

/**
 * Options shared by every pass.
 */
export interface GraphqlCompositionOptions {
	/**
	 * Report instead of throwing. A test run boots a deliberately broken schema to exercise the
	 * assertion itself, so `NODE_ENV=test` reports.
	 */
	readonly reportOnly?: boolean;
	/**
	 * Whether the kernel files are part of the analysed sources. A caller that analyses one domain's
	 * SDL on its own turns the kernel-ownership rules off rather than failing them.
	 */
	readonly requireKernel?: boolean;
}

/**
 * One SDL source: the text of a `.gql` file and the path it came from, used verbatim in messages.
 */
export interface GraphqlSdlSource {
	readonly file: string;
	readonly sdl: string;
}

/**
 * Raised when a pass found an error and was not asked to report only.
 */
export class GraphqlCompositionError extends Error {
	constructor(readonly report: GraphqlCompositionReport) {
		super(describeCompositionReport(report));
		this.name = 'GraphqlCompositionError';
	}
}

/* -------------------------------------------------------------------------------------------- */
/* SDL analysis                                                                                  */
/* -------------------------------------------------------------------------------------------- */

/**
 * One type declaration found in one file.
 */
interface SdlDeclaration {
	readonly name: string;
	readonly kind: string;
	readonly file: string;
	readonly extension: boolean;
	readonly fields: readonly string[];
}

/**
 * What indexing a set of SDL sources found.
 */
interface SdlIndex {
	readonly declarations: readonly SdlDeclaration[];
	readonly references: ReadonlyMap<string, readonly string[]>;
	readonly problems: readonly GraphqlCompositionProblem[];
}

/**
 * Reads every declaration out of a set of SDL sources.
 *
 * The parse is the `graphql` package's own, so the index is built from the same AST the schema
 * builder will see. A file that does not parse is recorded as a problem and skipped rather than
 * aborting the pass, because the other files' problems are usually what caused it.
 *
 * @param sources The SDL sources.
 * @returns The declarations, the type references and the syntax problems.
 */
function indexSdlSources(sources: readonly GraphqlSdlSource[]): SdlIndex {
	const declarations: SdlDeclaration[] = [];
	const references = new Map<string, string[]>();
	const problems: GraphqlCompositionProblem[] = [];

	for (const source of sources) {
		let document: DocumentNode;

		try {
			document = parse(source.sdl);
		} catch (error) {
			// A file that documents the contract and declares nothing is legitimate — the error
			// contract lives in comments beside the schema — and the merged document the schema
			// builder sees is unaffected by it. Only a file that meant to declare something and
			// failed is a problem.
			if (isCommentOnly(source.sdl)) {
				continue;
			}

			const message = error instanceof GraphQLError ? error.message : String(error);
			problems.push({ rule: 'unparseable-sdl', file: source.file, message: `${source.file}: ${message}` });
			continue;
		}

		for (const definition of document.definitions) {
			const declared = readDeclaration(definition, source.file);
			if (declared) {
				declarations.push(declared);
			}
		}

		// Every named type a file mentions, so a reference to a type nobody declares is caught here
		// rather than as a schema-builder failure.
		visit(document, {
			NamedType: (node) => {
				const files = references.get(node.name.value) ?? [];
				if (!files.includes(source.file)) {
					files.push(source.file);
				}
				references.set(node.name.value, files);
			}
		});

		problems.push(...readDeprecationProblems(document, source.file));
	}

	return { declarations, references, problems };
}

/**
 * Reads one AST definition as a declaration, or `undefined` when it declares no type.
 *
 * @param definition The definition node.
 * @param file The file it came from.
 * @returns The declaration.
 */
function readDeclaration(definition: DefinitionNode, file: string): SdlDeclaration | undefined {
	switch (definition.kind) {
		case Kind.OBJECT_TYPE_DEFINITION:
		case Kind.OBJECT_TYPE_EXTENSION:
			return {
				name: definition.name.value,
				kind: 'object',
				file,
				extension: definition.kind === Kind.OBJECT_TYPE_EXTENSION,
				fields: (definition.fields ?? []).map((field) => field.name.value)
			};
		case Kind.INPUT_OBJECT_TYPE_DEFINITION:
		case Kind.INPUT_OBJECT_TYPE_EXTENSION:
			return {
				name: definition.name.value,
				kind: 'input',
				file,
				extension: definition.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION,
				fields: (definition.fields ?? []).map((field) => field.name.value)
			};
		case Kind.ENUM_TYPE_DEFINITION:
		case Kind.ENUM_TYPE_EXTENSION:
			return {
				name: definition.name.value,
				kind: 'enum',
				file,
				extension: definition.kind === Kind.ENUM_TYPE_EXTENSION,
				fields: (definition.values ?? []).map((value) => value.name.value)
			};
		case Kind.SCALAR_TYPE_DEFINITION:
		case Kind.SCALAR_TYPE_EXTENSION:
			return { name: definition.name.value, kind: 'scalar', file, extension: definition.kind === Kind.SCALAR_TYPE_EXTENSION, fields: [] };
		case Kind.INTERFACE_TYPE_DEFINITION:
		case Kind.INTERFACE_TYPE_EXTENSION:
			return {
				name: definition.name.value,
				kind: 'interface',
				file,
				extension: definition.kind === Kind.INTERFACE_TYPE_EXTENSION,
				fields: (definition.fields ?? []).map((field) => field.name.value)
			};
		case Kind.UNION_TYPE_DEFINITION:
		case Kind.UNION_TYPE_EXTENSION:
			return { name: definition.name.value, kind: 'union', file, extension: definition.kind === Kind.UNION_TYPE_EXTENSION, fields: [] };
		default:
			// A schema definition, a directive definition, an operation or a fragment declares no type
			// of its own.
			return undefined;
	}
}

/**
 * Reports every `@deprecated` that does not say why.
 *
 * A deprecation without a replacement is a removal nobody can plan for: the checker removes a
 * deprecated element only after its declared release, so the reason is what makes the window real.
 *
 * @param document The parsed SDL.
 * @param file The file it came from.
 * @returns The problems found.
 */
function readDeprecationProblems(document: DocumentNode, file: string): GraphqlCompositionProblem[] {
	const problems: GraphqlCompositionProblem[] = [];

	const check = (node: Deprecatable): void => {
		if (!hasDeprecationMarker(node)) {
			return;
		}

		if (missingDeprecationReason(node)) {
			problems.push({
				rule: 'deprecation-without-reason',
				file,
				field: node.name.value,
				message: `${file}: "${node.name.value}" is deprecated without a reason. State the replacement and the release the element is removed in.`
			});
		}
	};

	visit(document, {
		FieldDefinition: (node) => check(node as unknown as Deprecatable),
		InputValueDefinition: (node) => check(node as unknown as Deprecatable),
		EnumValueDefinition: (node) => check(node as unknown as Deprecatable)
	});

	return problems;
}

/**
 * A node that can carry a `@deprecated` directive.
 */
interface Deprecatable {
	readonly name: { readonly value: string };
	readonly directives?: readonly {
		readonly name: { readonly value: string };
		readonly arguments?: readonly {
			readonly name: { readonly value: string };
			readonly value: { readonly value?: string };
		}[];
	}[];
}

/**
 * Whether a node carries the deprecation marker.
 *
 * The marker is read from the AST rather than from the built schema, because the schema builder
 * substitutes a default reason for a `@deprecated` written without one — which is exactly the case
 * this rule exists to catch.
 *
 * @param node The AST node.
 * @returns True when the node is deprecated.
 */
function hasDeprecationMarker(node: Deprecatable | undefined): boolean {
	return Boolean((node?.directives ?? []).some((directive) => directive.name.value === 'deprecated'));
}

/**
 * Whether a deprecation states no reason.
 *
 * @param node The AST node.
 * @returns True when the marker is present and the reason is absent or blank.
 */
function missingDeprecationReason(node: Deprecatable): boolean {
	const directive = (node.directives ?? []).find((entry) => entry.name.value === 'deprecated');
	if (!directive) {
		return false;
	}

	const reason = (directive.arguments ?? []).find((argument) => argument.name.value === 'reason');
	return !reason || !String(reason.value?.value ?? '').trim();
}

/**
 * Asserts the SDL-level composition rules over a set of `.gql` sources.
 *
 * This is the assertion a plain node process runs against the files on disk: it needs the `graphql`
 * package and nothing else — no Nest container, no configuration, no database.
 *
 * The rules are:
 *
 * - every kernel type is declared exactly once, by the kernel file that owns it;
 * - no other source declares a kernel type, so a domain references the kernel rather than
 *   redeclaring it;
 * - no other source declares a root operation type, because a second `type Query` cannot be merged;
 * - no two sources declare the same type, and no two sources contribute the same root field;
 * - a reserved name is never taken as a type name;
 * - a type name carries no package prefix;
 * - every referenced type is declared, and every `@deprecated` says why.
 *
 * @param sources The SDL files to analyse.
 * @param options Whether to report instead of throwing, and whether the kernel files are present.
 * @returns The report.
 * @throws GraphqlCompositionError when there is an error and `reportOnly` is not set.
 */
export function assertSdlComposition(
	sources: readonly GraphqlSdlSource[],
	options: GraphqlCompositionOptions = {}
): GraphqlCompositionReport {
	const index = indexSdlSources(sources);
	const errors: GraphqlCompositionProblem[] = [...index.problems];
	const requireKernel = options.requireKernel ?? sources.some((source) => isKernelFile(source.file));

	// Kernel ownership: exactly one declaration, in the file that owns the type. The three root types
	// are the exception in one direction only — a domain must extend them, which the next rule
	// checks — so an extension of any other kernel type is a redefinition like any other.
	for (const [typeName, owningFile] of Object.entries(GRAPHQL_KERNEL_TYPE_FILES)) {
		const declarations = index.declarations.filter((declaration) => declaration.name === typeName);
		const bare = declarations.filter((declaration) => !declaration.extension);
		const extensions = declarations.filter((declaration) => declaration.extension);

		if (bare.length === 0 && requireKernel) {
			errors.push({
				rule: 'missing-kernel-type',
				type: typeName,
				file: owningFile,
				message: `The kernel type "${typeName}" is not declared. It belongs in ${owningFile}.`
			});
		}

		for (const declaration of bare) {
			if (basename(declaration.file) !== owningFile) {
				errors.push({
					rule: 'kernel-type-redeclared',
					type: typeName,
					file: declaration.file,
					message:
						`${declaration.file} declares the kernel type "${typeName}", which is owned by ${owningFile}. ` +
						'A domain references a kernel type; it never declares one, because two declarations diverge ' +
						'the moment one of them is edited.'
				});
			}
		}

		if (bare.length > 1) {
			errors.push({
				rule: 'kernel-type-redeclared',
				type: typeName,
				message:
					`The kernel type "${typeName}" is declared ${bare.length} times ` +
					`(${bare.map((declaration) => declaration.file).join(', ')}). It must exist exactly once.`
			});
		}

		if (!GRAPHQL_ROOT_TYPE_NAMES.includes(typeName)) {
			for (const declaration of extensions) {
				errors.push({
					rule: 'kernel-type-redeclared',
					type: typeName,
					file: declaration.file,
					message:
						`${declaration.file} extends the kernel type "${typeName}". A kernel type is complete as ` +
						'declared; a domain that needs more adds its own type and references this one.'
				});
			}
		}
	}

	// Root types are declared once by the kernel and extended everywhere else.
	for (const rootName of GRAPHQL_ROOT_TYPE_NAMES) {
		const bare = index.declarations.filter((declaration) => declaration.name === rootName && !declaration.extension);
		const offenders = bare.filter((declaration) => basename(declaration.file) !== GRAPHQL_KERNEL_TYPE_FILES[rootName]);

		for (const offender of offenders) {
			errors.push({
				rule: 'root-type-redeclared',
				type: rootName,
				file: offender.file,
				message:
					`${offender.file} declares "type ${rootName}". A root operation type is declared once, in ` +
					`${GRAPHQL_KERNEL_TYPE_FILES[rootName]}; a domain adds fields with "extend type ${rootName}".`
			});
		}

		if (bare.length > 1 && offenders.length === 0) {
			errors.push({
				rule: 'root-type-redeclared',
				type: rootName,
				message: `"type ${rootName}" is declared ${bare.length} times; a root operation type cannot be merged.`
			});
		}
	}

	// One owner per type, and one owner per root field.
	const byType = groupBy(index.declarations.filter((declaration) => !GRAPHQL_ROOT_TYPE_NAMES.includes(declaration.name)), (declaration) => declaration.name);
	for (const [typeName, declarations] of byType) {
		const nonExtensions = declarations.filter((declaration) => !declaration.extension);
		if (nonExtensions.length > 1 && !GRAPHQL_KERNEL_TYPE_NAMES.includes(typeName)) {
			errors.push({
				rule: 'duplicate-type',
				type: typeName,
				message:
					`The type "${typeName}" is declared by ${nonExtensions.map((declaration) => declaration.file).join(' and ')}. ` +
					'A concept has one owner; the other domain references it.'
			});
		}
	}

	const rootFieldOwners = new Map<string, string[]>();
	for (const declaration of index.declarations) {
		if (!GRAPHQL_ROOT_TYPE_NAMES.includes(declaration.name)) {
			continue;
		}
		for (const field of declaration.fields) {
			const key = `${declaration.name}.${field}`;
			rootFieldOwners.set(key, [...(rootFieldOwners.get(key) ?? []), declaration.file]);
		}
	}
	for (const [key, files] of rootFieldOwners) {
		const unique = Array.from(new Set(files));
		if (unique.length > 1) {
			errors.push({
				rule: 'root-field-collision',
				field: key,
				message: `The root field "${key}" is contributed by ${unique.join(' and ')}. Rename one of them rather than relying on load order.`
			});
		}
	}

	// Names.
	for (const declaration of index.declarations) {
		const reserved = GRAPHQL_RESERVED_TYPE_NAMES.find((name) => name === declaration.name);
		if (reserved) {
			errors.push({
				rule: 'reserved-name',
				type: reserved,
				file: declaration.file,
				message: `"${reserved}" is a reserved name and cannot be a type. Qualify the concept instead of claiming the generic name.`
			});
		}

		const prefix = GRAPHQL_FORBIDDEN_TYPE_PREFIXES.find((candidate) => declaration.name.startsWith(candidate));
		if (prefix) {
			errors.push({
				rule: 'domain-prefixed-name',
				type: declaration.name,
				file: declaration.file,
				message: `The type "${declaration.name}" carries the "${prefix}" prefix. A type is named for the concept, which is unique inside one schema.`
			});
		}
	}

	// References resolve.
	const declaredNames = new Set(index.declarations.map((declaration) => declaration.name));
	for (const [typeName, files] of index.references) {
		if (GRAPHQL_BUILT_IN_TYPE_NAMES.includes(typeName) || typeName.startsWith('__')) {
			continue;
		}
		if (!declaredNames.has(typeName)) {
			errors.push({
				rule: 'unknown-type',
				type: typeName,
				file: files[0],
				message: `"${typeName}" is referenced by ${files.join(', ')} and declared nowhere. The schema cannot be built.`
			});
		}
	}

	const report = createReport(errors, [], {
		files: sources.length,
		types: declaredNames.size,
		rootFields: rootFieldOwners.size,
		unusedKernelTypes: []
	});

	if (report.errors.length > 0 && !options.reportOnly) {
		throw new GraphqlCompositionError(report);
	}

	return report;
}

/**
 * Builds the composed schema from a set of SDL sources.
 *
 * This is the same sequence the API boots with — concatenate, `buildSchema`, print — without the
 * configuration and the plugin registry around it, which is what lets the composition assertion run
 * in a plain node process.
 *
 * @param sources The SDL sources, in load order.
 * @param options Whether to report instead of throwing.
 * @returns The built schema, its printed SDL and the composition report.
 * @throws GraphqlCompositionError when the SDL does not compose and `reportOnly` is not set.
 */
export function composeSchemaFromSdl(
	sources: readonly GraphqlSdlSource[],
	options: GraphqlCompositionOptions = {}
): { readonly schema: GraphQLSchema; readonly typeDefs: string; readonly report: GraphqlCompositionReport } {
	const sdlReport = assertSdlComposition(sources, { ...options, reportOnly: options.reportOnly ?? false });

	let schema: GraphQLSchema;
	try {
		schema = buildASTSchema(parse(sources.map((source) => source.sdl).join('\n')));
	} catch (error) {
		const problem: GraphqlCompositionProblem = {
			rule: 'invalid-schema',
			message: error instanceof Error ? error.message : String(error)
		};
		const failed = createReport([...sdlReport.errors, problem], sdlReport.warnings, sdlReport.counts);
		throw new GraphqlCompositionError(failed);
	}

	const report = assertComposition(schema, options);

	return {
		schema,
		typeDefs: printSchema(schema),
		report: {
			errors: [...sdlReport.errors, ...report.errors],
			warnings: [...sdlReport.warnings, ...report.warnings],
			counts: report.counts
		}
	};
}

/* -------------------------------------------------------------------------------------------- */
/* Schema assertions                                                                             */
/* -------------------------------------------------------------------------------------------- */

/**
 * Asserts the composition rules over an assembled schema.
 *
 * Runs after `buildSchema` and after every plugin's SDL has been applied, and before the schema is
 * printed for the driver: a failure here is a boot failure with a message naming the type or the
 * field, rather than an Apollo startup error naming an internal schema-builder concern.
 *
 * @param schema The assembled schema.
 * @param options Whether to report instead of throwing.
 * @returns The report.
 * @throws GraphqlCompositionError when there is an error and `reportOnly` is not set.
 */
export function assertComposition(
	schema: GraphQLSchema,
	options: GraphqlCompositionOptions = {}
): GraphqlCompositionReport {
	const errors: GraphqlCompositionProblem[] = [];
	const warnings: GraphqlCompositionProblem[] = [];

	if (!schema || typeof schema.getTypeMap !== 'function') {
		throw new TypeError('assertComposition expects an assembled GraphQL schema.');
	}

	// The schema itself has to be valid: a type with no fields, an interface nobody implements and a
	// non-null field with no resolver all fail a request rather than a boot, so they are caught here.
	for (const error of validateSchema(schema)) {
		errors.push({ rule: 'invalid-schema', message: error.message });
	}

	const typeMap = schema.getTypeMap();
	const rootTypes = rootTypesOf(schema);

	// One root field, one owner.
	const rootFieldOwners = new Map<string, string[]>();
	for (const [rootKind, rootType] of rootTypes) {
		const seen = new Set<string>();
		for (const fieldName of Object.keys(rootType.getFields())) {
			if (seen.has(fieldName)) {
				errors.push({
					rule: 'root-field-collision',
					type: rootType.name,
					field: fieldName,
					message: `The root type "${rootType.name}" declares the field "${fieldName}" twice.`
				});
			}
			seen.add(fieldName);
			rootFieldOwners.set(fieldName, [...(rootFieldOwners.get(fieldName) ?? []), rootKind]);
		}
	}
	for (const [fieldName, kinds] of rootFieldOwners) {
		if (kinds.length > 1) {
			errors.push({
				rule: 'root-field-collision',
				field: fieldName,
				message: `The root field "${fieldName}" is declared by ${kinds.join(' and ')}. One name, one operation.`
			});
		}
	}

	// Reserved and prefixed names.
	for (const type of Object.values(typeMap)) {
		if (type.name.startsWith('__')) {
			continue;
		}
		if (GRAPHQL_RESERVED_TYPE_NAMES.includes(type.name)) {
			errors.push({
				rule: 'reserved-name',
				type: type.name,
				message: `"${type.name}" is a reserved name and cannot be a type.`
			});
		}
		const prefix = GRAPHQL_FORBIDDEN_TYPE_PREFIXES.find((candidate) => type.name.startsWith(candidate));
		if (prefix) {
			errors.push({
				rule: 'domain-prefixed-name',
				type: type.name,
				message: `The type "${type.name}" carries the "${prefix}" prefix; a type is named for the concept.`
			});
		}
	}

	// Deprecations say why.
	for (const type of Object.values(typeMap)) {
		for (const problem of readSchemaDeprecations(type)) {
			errors.push(problem);
		}
	}

	// Orphans: a domain type nothing reaches is a type whose resolver was never wired, which is worth
	// knowing before a client discovers it. A kernel type nothing reaches is expected while its first
	// domain has not landed, so it is counted rather than reported.
	const reachable = collectReachableTypes(rootTypes);
	const unusedKernelTypes: string[] = [];
	for (const type of Object.values(typeMap)) {
		if (type.name.startsWith('__') || reachable.has(type.name)) {
			continue;
		}
		// A built-in scalar is always in the type map whether or not the schema mentions it.
		if (GRAPHQL_BUILT_IN_TYPE_NAMES.includes(type.name)) {
			continue;
		}
		if (GRAPHQL_KERNEL_TYPE_NAMES.includes(type.name)) {
			unusedKernelTypes.push(type.name);
			continue;
		}
		warnings.push({
			rule: 'orphan-type',
			type: type.name,
			message: `The type "${type.name}" is declared and nothing references it. Land its resolver, or remove it.`
		});
	}

	const report = createReport(errors, warnings, {
		files: 0,
		types: Object.keys(typeMap).filter((name) => !name.startsWith('__')).length,
		rootFields: rootFieldOwners.size,
		unusedKernelTypes: unusedKernelTypes.sort()
	});

	if (report.errors.length > 0 && !options.reportOnly) {
		throw new GraphqlCompositionError(report);
	}

	return report;
}

/**
 * Asserts that a plugin's SDL can be applied to an assembled schema.
 *
 * A plugin adds types and fields and never redefines one. `extendSchema` refuses the redefinition
 * too, but only after the fact and without naming the contribution; this check names the type or the
 * field, which is what makes a broken plugin diagnosable from a boot log.
 *
 * @param schema The schema the document is about to extend.
 * @param document The plugin's parsed SDL.
 * @throws GraphqlCompositionError when the document redefines something.
 */
export function assertExtendable(schema: GraphQLSchema, document: DocumentNode): void {
	const errors: GraphqlCompositionProblem[] = [];
	const typeMap = schema.getTypeMap();
	const rootTypes = new Map(rootTypesOf(schema));

	for (const definition of document.definitions) {
		const declared = readDeclaration(definition, 'plugin SDL');
		if (!declared) {
			continue;
		}

		const existing = typeMap[declared.name];

		if (existing && !declared.extension) {
			errors.push({
				rule: 'plugin-type-redeclared',
				type: declared.name,
				message:
					`A plugin declares the type "${declared.name}", which the schema already declares. ` +
					'A plugin may add a type or extend the root types; it may never redefine a type.'
			});
			continue;
		}

		const rootType = rootTypes.get(declared.name);
		if (!rootType) {
			continue;
		}

		const existingFields = new Set(Object.keys(rootType.getFields()));
		for (const field of declared.fields) {
			if (existingFields.has(field)) {
				errors.push({
					rule: 'plugin-field-redeclared',
					type: declared.name,
					field,
					message: `A plugin contributes the root field "${declared.name}.${field}", which the schema already declares.`
				});
			}
		}
	}

	if (errors.length > 0) {
		throw new GraphqlCompositionError({ errors, warnings: [], counts: { files: 0, types: 0, rootFields: 0, unusedKernelTypes: [] } });
	}
}

/**
 * Renders a report as the text of a failure.
 *
 * @param report The report.
 * @returns The message.
 */
export function describeCompositionReport(report: GraphqlCompositionReport): string {
	const lines: string[] = [
		`The GraphQL schema did not compose: ${report.errors.length} error(s), ${report.warnings.length} warning(s).`
	];

	for (const problem of report.errors) {
		lines.push(`  [${problem.rule}] ${problem.message}`);
	}

	for (const problem of report.warnings) {
		lines.push(`  (warning) [${problem.rule}] ${problem.message}`);
	}

	return lines.join('\n');
}

/* -------------------------------------------------------------------------------------------- */
/* Internals                                                                                     */
/* -------------------------------------------------------------------------------------------- */

/**
 * The root types the schema actually declares, keyed by their role.
 *
 * @param schema The schema.
 * @returns The root types, in operation order.
 */
function rootTypesOf(schema: GraphQLSchema): Map<string, GraphQLObjectType> {
	const roots = new Map<string, GraphQLObjectType>();
	const query = schema.getQueryType();
	const mutation = schema.getMutationType();
	const subscription = schema.getSubscriptionType();

	if (query) roots.set('Query', query);
	if (mutation) roots.set('Mutation', mutation);
	if (subscription) roots.set('Subscription', subscription);

	return roots;
}

/**
 * Finds every `@deprecated` in the schema that does not say why.
 *
 * @param type A named type.
 * @returns The problems found on that type.
 */
function readSchemaDeprecations(type: GraphQLNamedType): GraphqlCompositionProblem[] {
	const problems: GraphqlCompositionProblem[] = [];

	const inspect = (owner: string, astNode: unknown): void => {
		const node = astNode as Deprecatable | undefined;
		if (hasDeprecationMarker(node) && missingDeprecationReason(node as Deprecatable)) {
			problems.push({
				rule: 'deprecation-without-reason',
				type: type.name,
				field: owner,
				message: `"${type.name}.${owner}" is deprecated without a reason. State the replacement and the release the element is removed in.`
			});
		}
	};

	if (isObjectLike(type)) {
		for (const [fieldName, field] of Object.entries(type.getFields() as Record<string, GraphQLField<unknown, unknown>>)) {
			inspect(fieldName, field.astNode);
			for (const argument of field.args) {
				inspect(`${fieldName}(${argument.name})`, argument.astNode);
			}
		}
	}

	if (isInputObjectType(type)) {
		for (const [fieldName, field] of Object.entries((type as GraphQLInputObjectType).getFields() as Record<string, GraphQLInputField>)) {
			inspect(fieldName, field.astNode);
		}
	}

	if (isEnumType(type)) {
		for (const value of (type as GraphQLEnumType).getValues()) {
			inspect(value.name, value.astNode);
		}
	}

	return problems;
}

/**
 * Collects every type reachable from the root types.
 *
 * @param roots The root types.
 * @returns The reachable type names.
 */
function collectReachableTypes(roots: Map<string, GraphQLObjectType>): Set<string> {
	const reachable = new Set<string>();
	const queue: GraphQLNamedType[] = Array.from(roots.values());

	while (queue.length > 0) {
		const type = queue.pop() as GraphQLNamedType;
		if (!type || reachable.has(type.name) || type.name.startsWith('__')) {
			continue;
		}
		reachable.add(type.name);

		if (isObjectLike(type)) {
			for (const field of Object.values(type.getFields() as Record<string, GraphQLField<unknown, unknown>>)) {
				queue.push(...namedTypesIn(field.type));
				for (const argument of field.args) {
					queue.push(...namedTypesIn(argument.type));
				}
			}
			for (const iface of (type as GraphQLObjectType | GraphQLInterfaceType).getInterfaces()) {
				queue.push(iface);
			}
		}

		if (isInputObjectType(type)) {
			for (const field of Object.values((type as GraphQLInputObjectType).getFields() as Record<string, GraphQLInputField>)) {
				queue.push(...namedTypesIn(field.type));
			}
		}

		if (type instanceof GraphQLUnionType) {
			queue.push(...(type as GraphQLUnionType).getTypes());
		}
	}

	return reachable;
}

/**
 * Unwraps a wrapper type to the named types inside it.
 *
 * @param type A GraphQL type.
 * @returns The named types, innermost first.
 */
function namedTypesIn(type: unknown): GraphQLNamedType[] {
	const names: GraphQLNamedType[] = [];
	let current: any = type;

	while (current) {
		if (current.ofType) {
			current = current.ofType;
			continue;
		}
		if (current.name) {
			names.push(current as GraphQLNamedType);
		}
		break;
	}

	return names;
}

/**
 * Whether a type carries fields.
 *
 * @param type A named type.
 * @returns True for an object or an interface type.
 */
function isObjectLike(type: GraphQLNamedType): type is GraphQLObjectType | GraphQLInterfaceType {
	return type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType;
}

/**
 * Whether a type is an input object.
 *
 * @param type A named type.
 * @returns True for an input object type.
 */
function isInputObjectType(type: GraphQLNamedType): boolean {
	return type instanceof GraphQLInputObjectType;
}

/**
 * Whether a type is an enum.
 *
 * @param type A named type.
 * @returns True for an enum type.
 */
function isEnumType(type: GraphQLNamedType): boolean {
	return type instanceof GraphQLEnumType;
}

/**
 * Whether a path names one of the kernel SDL files.
 *
 * @param file A path.
 * @returns True when the file is a kernel file.
 */
function isKernelFile(file: string): boolean {
	return GRAPHQL_KERNEL_SDL_FILES.includes(basename(file));
}

/**
 * Whether an SDL text carries only comments.
 *
 * A documentation file sitting beside the schema is a legitimate SDL file: the loader merges it into
 * the document without changing it, so it declares nothing and breaks nothing.
 *
 * @param sdl The file's text.
 * @returns True when nothing but comments and whitespace remains.
 */
function isCommentOnly(sdl: string): boolean {
	return sdl
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.every((line) => line.startsWith('#'));
}

/**
 * The final path segment.
 *
 * @param file A path written with either separator.
 * @returns The file name.
 */
function basename(file: string): string {
	return file.split(/[\\/]/).pop() ?? file;
}

/**
 * Groups entries by a key.
 *
 * @param entries The entries.
 * @param keyOf The key of an entry.
 * @returns The groups.
 */
function groupBy<T>(entries: readonly T[], keyOf: (entry: T) => string): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const entry of entries) {
		const key = keyOf(entry);
		groups.set(key, [...(groups.get(key) ?? []), entry]);
	}
	return groups;
}

/**
 * Assembles a report.
 *
 * @param errors The errors.
 * @param warnings The warnings.
 * @param counts The counts.
 * @returns The report.
 */
function createReport(
	errors: readonly GraphqlCompositionProblem[],
	warnings: readonly GraphqlCompositionProblem[],
	counts: GraphqlCompositionReport['counts']
): GraphqlCompositionReport {
	return { errors, warnings, counts };
}
