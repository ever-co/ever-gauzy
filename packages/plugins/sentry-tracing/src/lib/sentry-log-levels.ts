import type { LogLevel } from '@nestjs/common';

const NEST_LOG_LEVELS: readonly LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

/**
 * The Nest log levels that become Sentry events, from a comma-separated list such as `error,warn`
 * (the API reads SENTRY_LOG_LEVELS). Every other level is kept as a breadcrumb by SentryService.
 * Unknown names are ignored, and an empty or unusable value falls back to `error`: capturing every
 * log line spent the whole organisation's monthly error quota within hours of each reset.
 */
export function parseSentryLogLevels(value: string | undefined): LogLevel[] {
	const levels = (value ?? '')
		.split(',')
		.map((level) => level.trim().toLowerCase())
		.filter((level): level is LogLevel => NEST_LOG_LEVELS.includes(level as LogLevel));
	return levels.length ? [...new Set(levels)] : ['error'];
}
