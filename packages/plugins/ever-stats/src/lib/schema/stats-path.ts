import { STATS_SCHEMA } from './stats-schema';

/** Every name the schema uses: its property names, `$defs` keys, `const` and `enum` values. */
function vocabulary(node: unknown, words: Set<string>): Set<string> {
	if (Array.isArray(node)) {
		for (const item of node) vocabulary(item, words);
	} else if (node !== null && typeof node === 'object') {
		const schema = node as Record<string, unknown>;
		for (const key of ['properties', '$defs']) {
			const map = schema[key];
			if (map && typeof map === 'object') for (const name of Object.keys(map)) words.add(name);
		}
		if (typeof schema['const'] === 'string') words.add(schema['const']);
		if (Array.isArray(schema['enum'])) for (const value of schema['enum']) if (typeof value === 'string') words.add(value);
		for (const value of Object.values(schema)) vocabulary(value, words);
	}
	return words;
}

const WORDS = vocabulary(STATS_SCHEMA, new Set());

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
			const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~');
			return /^[A-Z]{3}$/.test(segment) || /^\d{1,2}$/.test(segment) || WORDS.has(segment) ? raw : '*';
		})
		.reduce((out, segment) => `${out}/${segment}`, '');
}
