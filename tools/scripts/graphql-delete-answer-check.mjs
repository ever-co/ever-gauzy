#!/usr/bin/env node
/**
 * Gate: a GraphQL delete field answers what the delete did, not a constant.
 *
 * `TenantAwareCrudService.delete` — the kernel's hard delete, and the one almost every service inherits —
 * performs no existence check: an identifier that names no row of the caller is a statement that matches
 * nothing, and it answers `{ affected: 0 }` without raising. REST hands that result to the client as it is,
 * so `DELETE /:id` of a missing row says "0 affected". A GraphQL field that awaits the same call, drops its
 * result and then answers `true` (or `deleted: true`, or a payload with the identifier and no error) says the
 * row was removed when nothing was — which is how ninety-odd `Boolean!` delete fields of the composed schema
 * came to answer `true` for a row that was never there (handover 2026-09-20 §7.65 item 21).
 *
 * The rule, read from every resolver's source: a mutation whose body awaits a hard `delete(…)` on a service
 * must consult what that call answered — assign it, return it, or hand it to a function (core's
 * `deleteRemovedRows`, a plugin's payload `deleteOutcome`) — unless the body reads the row first with a read
 * that raises when it is missing, in which case the constant it answers afterwards is true by construction.
 * A body that does neither is reported with its file, line and field.
 *
 * It does not judge services: a service whose own `delete` raises on a missing row makes a constant answer
 * truthful too, but a reader of the resolver cannot see that, and consulting the result costs nothing and
 * stays right if the service changes. So the rule asks every field to consult it.
 *
 * Run from the repository root: `node tools/scripts/graphql-delete-answer-check.mjs`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PACKAGES = join(ROOT, 'packages');

/** Directories that hold no source of the product. */
const SKIP = new Set(['node_modules', 'dist', '.nx', 'coverage', 'tmp']);

/** Every resolver source under a directory. */
function resolvers(directory, found = []) {
	for (const entry of readdirSync(directory)) {
		if (SKIP.has(entry)) continue;

		const path = join(directory, entry);

		if (statSync(path).isDirectory()) {
			resolvers(path, found);
		} else if (entry.endsWith('.resolver.ts') && !entry.endsWith('.spec.ts')) {
			found.push(path);
		}
	}

	return found;
}


/** The index of the bracket that closes the one at `open`, counting only that bracket pair. */
function closing(source, open, opener, closer) {
	let depth = 0;

	for (let index = open; index < source.length; index++) {
		const char = source[index];

		if (char === opener) depth++;
		else if (char === closer) {
			depth--;
			if (depth === 0) return index;
		}
	}

	return -1;
}

/**
 * Where a method's body opens, given the index just after its parameter list closes.
 *
 * The first `{` after the parameters is not always the body: a return type may contain one
 * (`Promise<{ affected: number }>`, or an object type `{ id: ID }` of its own). So the annotation is read as a
 * type: brackets nest (`<>`, `()`, `[]`, `{}`; the `>` of an arrow `=>` closes nothing), and a `{` met outside
 * every bracket opens an object *type* when it follows something that expects a type (`:`, `|`, `&`, `,`, `=>`)
 * and the body otherwise.
 *
 * @returns The index of the body's `{`, or -1.
 */
export function bodyOpen(source, afterParameters) {
	let depth = 0;
	let previous = '';

	for (let index = afterParameters; index < source.length; index++) {
		const char = source[index];

		if (/\s/.test(char)) continue;

		if (depth === 0 && char === '{') {
			const expectsType = [':', '|', '&', ','].includes(previous) || source.slice(index - 2, index).trim() === '=>';

			if (!expectsType) return index;

			index = closing(source, index, '{', '}');
			if (index < 0) return -1;
			previous = '}';
			continue;
		}

		if (char === '<' || char === '(' || char === '[' || char === '{') depth++;
		else if (char === ')' || char === ']' || char === '}') depth--;
		else if (char === '>' && source[index - 1] !== '=') depth--;
		else if (char === ';') return -1; // an abstract or overload signature: no body

		previous = char === '>' && source[index - 1] === '=' ? '=>' : char;
		if (previous === '=>') previous = ',';
	}

	return -1;
}

/**
 * The body of the method a decorator at `start` decorates, counted rather than matched by indentation.
 *
 * @returns The body text and the index it starts at, or null when no body follows.
 */
export function methodBody(source, start) {
	const method = source.indexOf('async ', start);
	const signature = source.indexOf('(', method >= 0 ? method : start);
	if (signature < 0) return null;

	const parametersClose = closing(source, signature, '(', ')');
	if (parametersClose < 0) return null;

	const open = bodyOpen(source, parametersClose + 1);
	if (open < 0) return null;

	const close = closing(source, open, '{', '}');
	if (close < 0) return null;

	return { body: source.slice(open + 1, close), at: open + 1 };
}

/**
 * A hard delete whose result is dropped: awaited as a statement of its own, or chained into a `.then` that
 * ignores what it was handed (`delete(id).then(() => true)`).
 */
const DROPPED_DELETE =
	/^\s*await\s+this\.[\w.]+\.(?:delete|deleteMany)\s*\(|^\s*(?:return\s+)?(?:await\s+)?this\.[\w.]+\.(?:delete|deleteMany)\s*\([^;]*\)\s*\.then\(\s*\(\s*\)\s*=>/m;

/** A read that raises when the row is missing, ahead of the delete. */
const RAISING_READ =
	/\b(findOneByIdString|findOneByWhereOptions|findOneByOptions|findOneOrFail|findOneScoped|getOneOrFail|findOneOrFailByIdString|findOrFail\w*|find\w*OrFail)\s*\(|throw new NotFoundException|NotFoundException\(/;

/** An answer that does not depend on what the delete did. */
const CONSTANT_ANSWER =
	/return\s+true\s*;|\.then\(\s*\(\)\s*=>\s*true\s*\)|\bdeleted\s*:\s*true\b|return\s*\{\s*id\s*,\s*userErrors\s*:\s*\[\]\s*\}/;

/**
 * The delete fields of one resolver source: each `@Mutation` that awaits a hard delete, and whether it answers a
 * constant after dropping the result with no raising read first.
 *
 * @returns `{ examined, findings: [{ name, line }] }`.
 */
export function examine(source) {
	const findings = [];
	let examined = 0;
	const decorator = /@Mutation\(/g;
	let match;

	while ((match = decorator.exec(source))) {
		const found = methodBody(source, match.index);
		if (!found) continue;

		const { body, at } = found;
		const dropped = DROPPED_DELETE.exec(body);
		if (!dropped) continue;

		examined++;

		if (RAISING_READ.test(body.slice(0, dropped.index))) continue;
		if (!CONSTANT_ANSWER.test(body.slice(dropped.index))) continue;

		const head = source.slice(match.index, at);
		const name =
			/name:\s*'([^']+)'/.exec(head)?.[1] ??
			/@Mutation\(\s*'([^']+)'/.exec(head)?.[1] ??
			/async\s+(\w+)\s*\(/.exec(head)?.[1] ??
			'?';
		const line = source.slice(0, at + dropped.index).split('\n').length + 1;

		findings.push({ name, line });
	}

	return { examined, findings };
}

function main() {
	const findings = [];
	let fields = 0;

	for (const file of resolvers(PACKAGES)) {
		const result = examine(readFileSync(file, 'utf8'));

		fields += result.examined;
		for (const { name, line } of result.findings) {
			findings.push(`${relative(ROOT, file).split('\\').join('/')}:${line} ${name}`);
		}
	}

	if (findings.length) {
		console.error(
			`FAILED — ${findings.length} GraphQL delete field(s) answer a constant after a hard delete whose result they drop.\n` +
				'An identifier that names no row of the caller deletes nothing and raises nothing, so each of these answers\n' +
				'"removed" for a row that was never there. Consult the result (core: deleteRemovedRows in\n' +
				'packages/core/src/lib/graphql/delete-answer.ts; a plugin: affected > 0, or its payload deleteOutcome), or\n' +
				'read the row first with a read that raises when it is missing:\n  ' +
				findings.join('\n  ')
		);
		process.exit(1);
	}

	console.log(
		`PASSED — every GraphQL delete field that awaits a hard delete answers from its result or from a raising read (${fields} field(s) examined).`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
