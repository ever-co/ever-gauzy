#!/usr/bin/env node
/**
 * Gate: every field a resolver claims must exist on the type the schema gives it.
 *
 * `@nestjs/graphql` builds the schema at boot from the SDL plus the resolver metadata, and it does not
 * tolerate the two disagreeing:
 *
 *   - a `@ResolveField('x')` on a class whose `@Resolver('T')` type does not declare `x` stops the
 *     application from starting at all — `OrderLineInvoice.invoiceLinks defined in resolvers, but not in
 *     schema` — which is a boot failure, not a runtime refusal;
 *   - a `@Query('x')` or `@Mutation('x')` that no root type declares is a field every caller is told does
 *     not exist, while the method that was written for it sits unreachable.
 *
 * This is the static half of that contract. The composed schema at
 * `packages/core/src/lib/graphql/schema/schema.graphql` is what the endpoint serves — it is generated
 * from the plugin schema extensions — so it is the truth this gate reads, and no Nest context is needed
 * to compare the two.
 *
 * Run from the repository root: `node tools/scripts/graphql-field-binding-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');
const PLUGINS = join(ROOT, 'packages', 'plugins');

/** The SDL, and one block per type, parsed once. */
const schema = readFileSync(SDL, 'utf8');

/** The body of `type <name> … { … }`, or null when the schema has no such type. */
function typeBody(name) {
	const pattern = new RegExp(`^type\\s+${name}\\b[^{]*\\{`, 'm');
	const start = schema.search(pattern);
	if (start === -1) return null;

	const open = schema.indexOf('{', start);
	let depth = 0;
	for (let index = open; index < schema.length; index++) {
		if (schema[index] === '{') depth++;
		else if (schema[index] === '}') {
			depth--;
			if (depth === 0) return schema.slice(open + 1, index);
		}
	}
	return null;
}

/** Whether a type declares a field of that name. */
function declares(typeName, field) {
	const body = typeBody(typeName);
	if (body === null) return 'missing-type';
	return new RegExp(`^\\s*${field}\\s*[(:]`, 'm').test(body) ? 'yes' : 'missing-field';
}

/** Every `.resolver.ts` under `packages/plugins`, skipping build output. */
function resolverFiles(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		if (entry === 'node_modules' || entry === 'dist') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			resolverFiles(full, found);
		} else if (entry.endsWith('.resolver.ts') && !entry.endsWith('.spec.ts')) {
			found.push(full);
		}
	}
	return found;
}

const failures = [];
const checked = { fields: 0, roots: 0, resolvers: 0, abstractTypes: 0 };

for (const file of resolverFiles(PLUGINS)) {
	const source = readFileSync(file, 'utf8');
	const path = relative(ROOT, file).split('\\').join('/');

	const classType = source.match(/@Resolver\(\s*'([^']+)'\s*\)/);
	if (!classType) continue;
	checked.resolvers++;

	const typeName = classType[1];
	const body = typeBody(typeName);
	if (body === null) {
		// An interface or union the plugin declares is legitimate: `@Resolver('X')` may name an abstract
		// type, and the field then belongs to each implementation.
		if (new RegExp(`^(?:interface|union)\\s+${typeName}\\b`, 'm').test(schema)) {
			checked.abstractTypes++;
			continue;
		}
		failures.push(`${path} -> @Resolver('${typeName}') names a type the schema does not declare`);
		continue;
	}

	for (const match of source.matchAll(/@(ResolveField|Query|Mutation|Subscription)\(\s*'([^']+)'/g)) {
		const [line, kind, field] = [match[0], match[1], match[2]];
		const lineNumber = source.slice(0, match.index).split('\n').length;

		if (kind === 'ResolveField') {
			checked.fields++;
			const verdict = declares(typeName, field);
			if (verdict === 'missing-field') {
				failures.push(`${path}:${lineNumber} -> \`${field}\` is not declared on \`${typeName}\``);
			}
			continue;
		}

		checked.roots++;
		const rootType = kind === 'Query' ? 'Query' : kind === 'Mutation' ? 'Mutation' : 'Subscription';
		if (declares(rootType, field) !== 'yes') {
			failures.push(`${path}:${lineNumber} -> @${kind}('${field}') is not declared on \`${rootType}\``);
		}
	}
}

if (failures.length > 0) {
	console.error('FAILED — resolver fields the composed schema does not declare:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error(`${failures.length} unbound field(s) of ${checked.fields + checked.roots} checked.`);
	process.exit(1);
}

console.log(
	`PASSED — ${checked.fields} resolved field(s) and ${checked.roots} root field(s) across ` +
		`${checked.resolvers} plugin resolver(s) all exist on the type that resolves them` +
		(checked.abstractTypes > 0 ? ` (${checked.abstractTypes} abstract type(s) skipped)` : '') +
		'.'
);
