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
import { join, relative } from 'node:path';
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

/**
 * The body of the method a decorator at `start` decorates: from the first `{` after its parameter list to
 * the brace that closes it, counted rather than matched by indentation.
 *
 * @returns The body text and the index it starts at, or null when no body follows.
 */
function methodBody(source, start) {
	// The parameter list closes before the body opens; skip past it so a default `{}` in a parameter is not
	// taken for the body.
	const method = source.indexOf('async ', start);
	const signature = source.indexOf('(', method >= 0 ? method : start);
	if (signature < 0) return null;

	let depth = 0;
	let index = signature;
	for (; index < source.length; index++) {
		const char = source[index];
		if (char === '(') depth++;
		else if (char === ')') {
			depth--;
			if (depth === 0) break;
		}
	}

	const open = source.indexOf('{', index);
	if (open < 0) return null;

	depth = 0;
	for (let end = open; end < source.length; end++) {
		const char = source[end];
		if (char === '{') depth++;
		else if (char === '}') {
			depth--;
			if (depth === 0) return { body: source.slice(open + 1, end), at: open + 1 };
		}
	}

	return null;
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

const findings = [];
let fields = 0;

for (const file of resolvers(PACKAGES)) {
	const source = readFileSync(file, 'utf8');
	const decorator = /@Mutation\(/g;
	let match;

	while ((match = decorator.exec(source))) {
		const found = methodBody(source, match.index);
		if (!found) continue;

		const { body, at } = found;
		const dropped = DROPPED_DELETE.exec(body);
		if (!dropped) continue;

		fields++;

		const before = body.slice(0, dropped.index);
		if (RAISING_READ.test(before)) continue;
		if (!CONSTANT_ANSWER.test(body.slice(dropped.index))) continue;

		const name =
			/name:\s*'([^']+)'/.exec(source.slice(match.index, at))?.[1] ??
			/@Mutation\(\s*'([^']+)'/.exec(source.slice(match.index, at))?.[1] ??
			/async\s+(\w+)\s*\(/.exec(source.slice(match.index, at))?.[1] ??
			'?';
		const line = source.slice(0, at + dropped.index).split('\n').length + 1;

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
