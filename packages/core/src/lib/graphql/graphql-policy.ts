/**
 * What the GraphQL surface exposes in this deployment, decided once per boot.
 *
 * Two decisions are made here and they are made the same way. The first is what the deployment
 * publishes: the playground is a full query editor served from the API and introspection is a
 * complete map of every operation the platform has — both are development tools, and both were on
 * in every environment because the shipped configurations say `true` and nothing consulted the
 * environment at all. The second is what the deployment accepts: a query language with no depth,
 * cost, alias or batch ceiling lets one request ask for an arbitrarily expensive document, and the
 * ceilings are configuration rather than code so they can be raised without a deploy.
 *
 * The environment is the override and the existing development behaviour is the default, so a
 * workstation, a `develop` deployment and a `stage` deployment get exactly what they got before,
 * while a production deployment stops publishing a schema map unless it is told to.
 */

/** The four ceilings a query is measured against. */
export interface IGraphqlLimitSettings {
	/** Maximum selection-set depth. */
	maxDepth?: number;
	/** Maximum weighted cost of one operation. */
	maxComplexity?: number;
	/** Maximum number of aliased fields in one operation. */
	maxAliases?: number;
	/** Maximum number of operations in one HTTP request. */
	maxBatchSize?: number;
}

/** The deployment's settings, as the shipped configuration object states them. */
export interface IGraphqlPolicySettings {
	playground?: boolean;
	debug?: boolean;
	introspection?: boolean;
	persistedQueries?: boolean;
	limits?: IGraphqlLimitSettings;
}

/** The resolved policy. */
export interface IGraphqlPolicy {
	playground: boolean;
	debug: boolean;
	introspection: boolean;
	persistedQueries: boolean;
	maxDepth: number;
	maxComplexity: number;
	maxAliases: number;
	maxBatchSize: number;
	/** Anything the environment stated that could not be used, for the boot log. */
	warnings: string[];
}

/** The environment variables the policy reads. */
export const GRAPHQL_POLICY_ENV = {
	PLAYGROUND: 'GRAPHQL_PLAYGROUND',
	DEBUG: 'GRAPHQL_DEBUG',
	INTROSPECTION: 'GRAPHQL_INTROSPECTION',
	PERSISTED_QUERIES: 'GRAPHQL_PERSISTED_QUERIES',
	MAX_DEPTH: 'GRAPHQL_MAX_DEPTH',
	MAX_COMPLEXITY: 'GRAPHQL_MAX_COMPLEXITY',
	MAX_ALIASES: 'GRAPHQL_MAX_ALIASES',
	MAX_BATCH_SIZE: 'GRAPHQL_MAX_BATCH_SIZE'
} as const;

/**
 * The ceilings a deployment that configures nothing gets.
 *
 * Generous enough that no ordinary client meets them — the cost model prices a page of a hundred
 * rows with a batched relation at 1800 — and low enough that a query built to consume the database
 * is refused before it runs.
 */
export const GRAPHQL_LIMIT_DEFAULTS: Required<IGraphqlLimitSettings> = {
	maxDepth: 12,
	maxComplexity: 5000,
	maxAliases: 50,
	maxBatchSize: 10
};

/**
 * Reads a boolean an operator wrote in the environment.
 *
 * Only the forms an operator actually writes are accepted. Anything else is reported as unusable
 * rather than guessed at, because guessing "on" for a typo would publish a schema map nobody asked
 * for, and guessing "off" would take the playground away from a developer who meant to keep it.
 *
 * @param value The raw value.
 * @returns The boolean, or undefined when the value says neither.
 */
export function parseGraphqlBoolean(value: unknown): boolean | undefined {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	switch (value.trim().toLowerCase()) {
		case 'true':
		case '1':
		case 'yes':
		case 'on':
			return true;
		case 'false':
		case '0':
		case 'no':
		case 'off':
			return false;
		default:
			return undefined;
	}
}

/**
 * Reads a ceiling an operator wrote in the environment.
 *
 * A value that is not a positive integer falls back to the default and is reported, rather than
 * failing the boot: a typo in one ceiling must not take the API down, and accepting the typo as "no
 * limit" is the failure this module exists to prevent.
 *
 * @param value The raw value.
 * @param fallback The value to use when the raw value is unusable.
 * @param name The variable name, for the warning.
 * @param warnings The list the warning is appended to.
 * @returns The ceiling to apply.
 */
export function parseGraphqlLimit(value: unknown, fallback: number, name: string, warnings: string[]): number {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}

	const parsed = typeof value === 'number' ? value : Number(String(value).trim());

	if (!Number.isInteger(parsed) || parsed < 1) {
		warnings.push(`${name} is not a positive integer; ${fallback} is used instead.`);

		return fallback;
	}

	return parsed;
}

/**
 * Layers limit settings, later sources winning.
 *
 * The shipped configuration object and the boot call site can both state a ceiling, and an operator
 * can state it in the environment. Layering rather than picking one source is what lets a value
 * configured in any of the three take effect.
 *
 * @param sources The settings to layer, in increasing priority.
 * @returns The layered ceilings.
 */
export function mergeLimitSettings(...sources: Array<IGraphqlLimitSettings | undefined>): IGraphqlLimitSettings {
	return sources.reduce<IGraphqlLimitSettings>((merged, source) => {
		if (!source) {
			return merged;
		}

		const next = { ...merged };

		for (const key of ['maxDepth', 'maxComplexity', 'maxAliases', 'maxBatchSize'] as const) {
			const value = source[key];

			if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
				next[key] = Math.floor(value);
			}
		}

		return next;
	}, {});
}

/**
 * Reads the four ceilings from the environment.
 *
 * A ceiling the environment does not state is left undefined so it cannot overwrite a configured
 * one; a ceiling the environment states badly is reported and replaced by the built-in default,
 * which is the value the warning names.
 *
 * @param env The environment.
 * @param warnings The list unusable values are reported into.
 * @returns The ceilings the environment states.
 */
export function limitsFromEnvironment(
	env: Record<string, string | undefined>,
	warnings: string[] = []
): IGraphqlLimitSettings {
	const read = (name: string, fallback: number): number | undefined => {
		const raw = env?.[name];

		if (raw === undefined || raw === null || raw === '') {
			return undefined;
		}

		return parseGraphqlLimit(raw, fallback, name, warnings);
	};

	return {
		maxDepth: read(GRAPHQL_POLICY_ENV.MAX_DEPTH, GRAPHQL_LIMIT_DEFAULTS.maxDepth),
		maxComplexity: read(GRAPHQL_POLICY_ENV.MAX_COMPLEXITY, GRAPHQL_LIMIT_DEFAULTS.maxComplexity),
		maxAliases: read(GRAPHQL_POLICY_ENV.MAX_ALIASES, GRAPHQL_LIMIT_DEFAULTS.maxAliases),
		maxBatchSize: read(GRAPHQL_POLICY_ENV.MAX_BATCH_SIZE, GRAPHQL_LIMIT_DEFAULTS.maxBatchSize)
	};
}

/**
 * Resolves what this deployment publishes and accepts.
 *
 * Precedence, in order: the environment variable when it is set; an explicit `false` in the shipped
 * configuration, which is a deployment saying "not here"; and otherwise the derivation — on outside
 * production, off inside it. The middle rule matters: all three shipped configurations declare
 * `playground: true` and `debug: true` for every environment, so giving that `true` priority would
 * leave the defect in place, while treating an explicit `false` as final keeps an operator's
 * opt-out meaningful.
 *
 * Introspection follows the playground unless it is stated separately, because they are one policy:
 * a deployment that stopped serving the playground has no reason to keep publishing the schema it
 * is edited against.
 *
 * @param env The environment to read, normally `process.env`.
 * @param settings What the deployment configured.
 * @returns The policy, with any unusable value reported in `warnings`.
 */
export function resolveGraphqlPolicy(
	env: Record<string, string | undefined>,
	settings: IGraphqlPolicySettings = {}
): IGraphqlPolicy {
	const warnings: string[] = [];
	const isProduction = env?.NODE_ENV === 'production';

	const playground = readBoolean(
		env,
		GRAPHQL_POLICY_ENV.PLAYGROUND,
		settings.playground === false ? false : !isProduction,
		warnings,
		'the environment default is used'
	);

	// Debug output carries the same information the playground exposes, one log line at a time, so it
	// follows the playground unless a deployment separates them on purpose.
	const debug = readBoolean(env, GRAPHQL_POLICY_ENV.DEBUG, settings.debug === false ? false : playground, warnings, 'the playground policy is used');

	// Introspection is a pair with the playground: both describe the surface, and a deployment that
	// turned the editor off has no reason to keep publishing the map.
	const introspection = readBoolean(
		env,
		GRAPHQL_POLICY_ENV.INTROSPECTION,
		settings.introspection === false ? false : playground,
		warnings,
		'the playground policy is used'
	);

	const persistedQueries = readBoolean(
		env,
		GRAPHQL_POLICY_ENV.PERSISTED_QUERIES,
		settings.persistedQueries ?? false,
		warnings,
		'the configured policy is used'
	);

	const limits = mergeLimitSettings(GRAPHQL_LIMIT_DEFAULTS, settings.limits, limitsFromEnvironment(env, warnings));

	return {
		playground,
		debug,
		introspection,
		persistedQueries,
		maxDepth: limits.maxDepth as number,
		maxComplexity: limits.maxComplexity as number,
		maxAliases: limits.maxAliases as number,
		maxBatchSize: limits.maxBatchSize as number,
		warnings
	};
}

/**
 * Reads one boolean from the environment over a default.
 *
 * @param env The environment.
 * @param name The variable name.
 * @param fallback The value to use when the variable says nothing usable.
 * @param warnings The list unusable values are reported into.
 * @param consequence What happens instead, for the warning.
 * @returns The boolean to apply.
 */
function readBoolean(
	env: Record<string, string | undefined>,
	name: string,
	fallback: boolean,
	warnings: string[],
	consequence: string
): boolean {
	const raw = env?.[name];

	if (raw === undefined || raw === null || raw === '') {
		return fallback;
	}

	const parsed = parseGraphqlBoolean(raw);

	if (parsed === undefined) {
		warnings.push(`${name} is not a boolean; ${consequence}.`);

		return fallback;
	}

	return parsed;
}
