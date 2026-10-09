import { STATS_SCHEMA } from './stats-schema';

const isObject = (v: unknown): v is { [key: string]: unknown } => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Every property name the schema declares, anywhere (its vocabulary): the same words as the SDK's
 * own redaction (`redactStatsPath` in `@ever-co/connect-sdk`, not exported) and this module's
 * former copy of it.
 */
function vocabulary(schema: unknown, words = new Set<string>()): Set<string> {
	if (Array.isArray(schema)) {
		for (const item of schema) vocabulary(item, words);
	} else if (isObject(schema)) {
		if (isObject(schema.properties)) for (const name of Object.keys(schema.properties)) words.add(name);
		for (const value of Object.values(schema)) vocabulary(value, words);
	}
	return words;
}

const WORDS = vocabulary(STATS_SCHEMA);

/**
 * A field path fit for a log line: a segment stays when the schema names it, or it is a currency
 * code or an array index; any other segment (an unknown key, which could be a name or an e-mail
 * address) becomes `*`.
 */
export function redactStatsPath(path: string): string {
	if (path === '') return '';
	return path
		.split('/')
		.slice(1)
		.map((raw) => {
			const segment = raw.replaceAll('~1', '/').replaceAll('~0', '~');
			return /^[A-Z]{3}$/.test(segment) || /^\d{1,2}$/.test(segment) || WORDS.has(segment) ? raw : '*';
		})
		.reduce((out, segment) => `${out}/${segment}`, '');
}
