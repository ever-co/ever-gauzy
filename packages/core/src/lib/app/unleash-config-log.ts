import type { UnleashConfig } from 'unleash-client';
import { redactHeaderValues, redactUrlCredentials } from '../core/util/redact-credentials';

/**
 * Builds the `Using Unleash Config: ...` boot log line.
 *
 * The Unleash API key travels in `customHeaders.Authorization`, so serializing the config as-is
 * wrote the key to stdout. This keeps every field an operator needs, but lists the custom headers
 * by name only and redacts any credentials embedded in the server URL.
 *
 * @param config - The config handed to `initialize()` from `unleash-client`.
 * @returns The log line, safe to write to stdout.
 */
export function describeUnleashConfig(config: UnleashConfig): string {
	const { customHeaders, ...rest } = config;

	return `Using Unleash Config: ${JSON.stringify({
		...rest,
		url: redactUrlCredentials(rest.url),
		customHeaders: redactHeaderValues(customHeaders)
	})}`;
}
