import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Node = { [key: string]: unknown };
const isObject = (v: unknown): v is Node => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The allow-list rules the schema must keep, whatever its content:
 * - every object level is closed: `additionalProperties: false`, or a map whose keys are bound by
 *   `propertyNames` with a pattern and whose size is bound by `maxProperties`;
 * - every string is bound: `const`, `enum`, or `pattern` with `maxLength` at most 64.
 */
export function metaViolations(schema: unknown, path = '#'): string[] {
	const out: string[] = [];
	const visit = (node: unknown, at: string) => {
		if (Array.isArray(node)) {
			node.forEach((item, i) => visit(item, `${at}/${i}`));
			return;
		}
		if (!isObject(node)) return;
		const isObjectType = node['type'] === 'object';
		if (isObjectType && node['additionalProperties'] !== false) {
			const names = node['propertyNames'];
			const boundMap = isObject(names) && typeof names['pattern'] === 'string' && typeof node['maxProperties'] === 'number';
			if (!boundMap) out.push(`${at}: object not closed`);
		}
		if (node['type'] === 'string') {
			const bound = 'const' in node || Array.isArray(node['enum']) || (typeof node['pattern'] === 'string' && typeof node['maxLength'] === 'number' && (node['maxLength'] as number) <= 64);
			if (!bound) out.push(`${at}: string not bound`);
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === 'description' || key === '$comment') continue;
			visit(value, `${at}/${key}`);
		}
	};
	visit(schema, path);
	return out;
}

describe('ever.stats.v1 schema allow-list rules', () => {
	const schema = JSON.parse(readFileSync(join(__dirname, 'ever.stats.v1.schema.json'), 'utf8'));

	it('closes every object and bounds every string', () => {
		expect(metaViolations(schema)).toEqual([]);
	});

	it('fails when one level is opened (control)', () => {
		const copy = JSON.parse(JSON.stringify(schema));
		delete copy.$defs.gauzy.counts.properties.integrations_in_use.additionalProperties;
		expect(metaViolations(copy)).toEqual(['#/$defs/gauzy/counts/properties/integrations_in_use: object not closed']);
	});

	it('fails when a string is unbounded (control)', () => {
		const copy = JSON.parse(JSON.stringify(schema));
		delete copy.properties.version.pattern;
		expect(metaViolations(copy)).toEqual(['#/properties/version: string not bound']);
	});
});
