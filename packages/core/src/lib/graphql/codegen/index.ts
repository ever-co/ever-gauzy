import { API_QUERY_LIMITS, resolveDefaultPageSize, resolveMaxPageSize } from '../../api/query-ast';
import type { ApiQuerySchema } from '../../api/query-schema';
import {
	assertGeneratedInputParity,
	assertOperatorProjectionSupported,
	assertUniqueInputTypeNames,
	GeneratedInputFile,
	GeneratedInputs,
	GENERATED_INPUT_DIRECTORY,
	generateResourceInputs
} from './filter-inputs';

/**
 * The generated GraphQL inputs, as one pure function.
 *
 * The generation target and the contract gate both call this, so what is committed and what is
 * asserted are the same bytes by construction rather than by review. The function reads the
 * declarations and returns files; it does not write them, does not boot a container, and does not
 * need a database, which is what makes it callable from a build step, a test and a script alike.
 *
 * Three assertions run before anything is emitted, and each one exists because of a way the two
 * surfaces could otherwise drift:
 *
 * 1. **the operator projection** — nothing generated may advertise an operator the parser refuses;
 * 2. **the declaration parity** — the filter fields, the sort enum and the relation filters must
 *    equal what the schema declares, in both directions;
 * 3. **the type names** — two resources may not generate one type name, because the printed schema
 *    would then depend on the loader's file order.
 */

export interface GenerateGraphqlInputsOptions {
	/** The directory the fragments are written to, relative to the workspace root. */
	readonly directory?: string;
	/** The page-size limits, defaulting to the platform's own. */
	readonly limits?: { readonly defaultPageSize: number; readonly maxPageSize: number };
}

/**
 * Generates the filter, sort and pagination fragments of every declared resource.
 *
 * @param schemas The resource query schemas, as the registry collected them.
 * @param options The output directory and the page-size limits.
 * @returns The generated files, and any warning the generation produced.
 * @throws Error when a projection, a parity check or a type name fails.
 */
export function generateGraphqlInputs(
	schemas: readonly ApiQuerySchema[],
	options: GenerateGraphqlInputsOptions = {}
): GeneratedInputs {
	assertOperatorProjectionSupported();
	assertUniqueInputTypeNames(schemas);

	const directory = options.directory ?? GENERATED_INPUT_DIRECTORY;
	const limits = options.limits ?? {
		defaultPageSize: resolveDefaultPageSize(API_QUERY_LIMITS.defaultPageSize, API_QUERY_LIMITS.maxPageSize),
		maxPageSize: resolveMaxPageSize(API_QUERY_LIMITS.maxPageSize)
	};

	const files: GeneratedInputFile[] = [];
	const warnings: string[] = [];

	for (const schema of schemas) {
		assertGeneratedInputParity(schema);
		const generated = generateResourceInputs(schema, limits, directory);
		files.push(...generated.files);
		warnings.push(...generated.warnings);
	}

	return { files, warnings };
}

export * from './filter-inputs';
export { GENERATED_INPUT_DIRECTORY };
