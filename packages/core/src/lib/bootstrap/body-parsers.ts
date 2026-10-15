import type { IncomingMessage } from 'node:http';
import { json, urlencoded } from 'express';

/** The environment variable that raises or lowers the GraphQL body ceiling, in bytes. */
export const GRAPHQL_MAX_BODY_BYTES_ENV = 'GRAPHQL_MAX_BODY_BYTES';

/** What a GraphQL request body may weigh when the environment states nothing: a document and its variables. */
export const GRAPHQL_MAX_BODY_BYTES_DEFAULT = 1024 * 1024;

/** What any other JSON or form body may weigh (imports, uploads of structured data). */
export const DEFAULT_MAX_BODY = '50mb';

/** Something JSON and form parsers can be mounted on: the Nest application, or a bare Express app. */
export interface IBodyParserHost {
	use(...handlers: unknown[]): unknown;
}

/**
 * The GraphQL body ceiling the environment states, in bytes.
 *
 * A value that is not a positive whole number of bytes falls back to the default and is reported: a typo must
 * neither fail the boot nor become "no ceiling".
 *
 * @param env The environment.
 * @param warnings The list an unusable value is reported into.
 * @returns The ceiling in bytes.
 */
export function resolveGraphqlBodyLimit(env: Record<string, string | undefined>, warnings: string[] = []): number {
	const raw = env?.[GRAPHQL_MAX_BODY_BYTES_ENV];

	if (raw === undefined || raw === null || raw.trim() === '') {
		return GRAPHQL_MAX_BODY_BYTES_DEFAULT;
	}

	const parsed = Number(raw.trim());

	if (!Number.isInteger(parsed) || parsed < 1) {
		warnings.push(`${GRAPHQL_MAX_BODY_BYTES_ENV} is not a positive whole number of bytes; ${GRAPHQL_MAX_BODY_BYTES_DEFAULT} is used instead.`);

		return GRAPHQL_MAX_BODY_BYTES_DEFAULT;
	}

	return parsed;
}

/**
 * Mounts the request body parsers.
 *
 * Every route accepts a JSON or form body of up to 50 MB. The GraphQL endpoint is mounted first with a ceiling of
 * its own (SEC-C-03): its body is a document and its variables, and it is parsed and validated BEFORE
 * authentication — 50 MB of document was 50 MB of pre-auth parsing and validation work. A parser skips a body an
 * earlier one already read, so the endpoint's ceiling is the one that applies there; the parser's own token ceiling
 * (`GRAPHQL_MAX_TOKENS`) then bounds what the validation of an accepted body costs.
 *
 * @param app Where to mount them.
 * @param options The GraphQL endpoint's path, the environment, and the hook that keeps the raw body for signature checks.
 * @returns Anything the environment stated that could not be used, for the boot log.
 */
export function installBodyParsers(
	app: IBodyParserHost,
	options: {
		graphqlPath: string;
		env: Record<string, string | undefined>;
		verify?: (request: IncomingMessage & { rawBody?: Buffer }, response: unknown, buffer: Buffer) => void;
	}
): string[] {
	const warnings: string[] = [];
	const verify = options.verify as any;

	app.use(options.graphqlPath, json({ limit: resolveGraphqlBodyLimit(options.env, warnings), verify }));
	app.use(json({ limit: DEFAULT_MAX_BODY, verify }));
	app.use(urlencoded({ extended: true, limit: DEFAULT_MAX_BODY, verify }));

	return warnings;
}
