#!/usr/bin/env node
/*
 * A method that raises is not a method that answers null.
 *
 * `findOneByOptions` and `findOneByWhereOptions` raise `NotFoundException` when nothing matches. For a
 * long time their declaration said `Promise<T | null>` and their doc comment promised null, and
 * nothing caught the contradiction — this workspace compiles without `strictNullChecks`, where
 * `T | null` collapses to `T` and a comment cannot be checked at all. The kernel text has since been
 * corrected, but the call sites written against the old promise are still there, and each one is a
 * route that refuses the case it meant to handle: a provider whose code is free can never be
 * registered, a first collection is refused, a first webhook callback is never stored, a category
 * with a free code can never be created. Seven were found by accident, in packages that happened to
 * have tests; the eighth was found in a package nobody was looking at, which is the reason for this
 * script.
 *
 * It reads every source file, finds each call to one of the two throwing reads, works out whether the
 * result is *used* as though it could be null, and reports the ones that are. A call the author
 * null-checks is a call the author believed could miss — either it is one of these defects, or the
 * branch is dead code, and both are worth a line in a report.
 *
 * Usage:
 *   node tools/scripts/nullable-read-check.mjs [repoRoot]
 *
 * Exits 0 when no throwing read is used as a nullable one, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');

/** The throwing reads, and the fail-soft pair the platform uses when a miss is an answer. */
const THROWING = /\bfindOneBy(?:Where)?Options\s*\(/;
const FAIL_SOFT = /\bfindOneOrFailBy(?:Where)?Options\s*\(/;

/**
 * Where the script looks.
 *
 * The programme's packages and the application, because a call site is a caller and callers live in
 * both. The kernel is excluded: it is where the two methods are *declared*, and the declaration is
 * the thing all of this is measured against. So are this repository's other plugin packages, which
 * belong to other features and are not this programme's to rewrite — a report that mixed them in
 * would bury the call sites that are.
 */
const PROGRAMME_PACKAGES = [
	'catalog',
	'pricing',
	'tax',
	'inventory',
	'warehouse',
	'cart',
	'order',
	'payment',
	'promotion',
	'fulfillment',
	'returns',
	'subscription',
	'purchasing',
	'entitlement',
	'marketplace',
	'search'
];

const ROOTS = [
	...PROGRAMME_PACKAGES.map((name) => join(ROOT, 'packages', 'plugins', name)),
	join(ROOT, 'apps')
];

/** Reads a file, or the empty string when it cannot be read. */
function read(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

/** Every `.ts` file under `dir` that is not a spec. */
function sources(dir, out = []) {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}

	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
			sources(full, out);
		} else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
			out.push(full);
		}
	}

	return out;
}

/** The variable a call is assigned to, searching the call's own line and the two before it. */
function assignedTo(lines, index) {
	for (let cursor = index; cursor >= Math.max(0, index - 2); cursor--) {
		const match = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:await\s+)?(?:this\.)?[\w.]*$/.exec(
			lines[cursor].replace(/\s+$/, '')
		);
		if (match) return match[1];

		const simple = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+/.exec(lines[cursor]);
		if (simple) return simple[1];
	}

	return null;
}

/**
 * Whether the window after a call uses the result as though it could be absent.
 *
 * A null-check alone does not make a defect. Most of the call sites that have one are *defensive*:
 * the read would already have raised, so the branch below it can never run, and the code is merely
 * dead. The defect is the other kind — a branch that treats absence as an ordinary answer, by
 * creating the row that was not there, by returning nothing, or by carrying on. So the branch is
 * classified by what it does: one that throws is dead code and is reported as such, and one that
 * does anything else is a path that refuses the case it meant to handle.
 *
 * @param lines The file's lines.
 * @param index The call's line.
 * @param variable The variable the result was assigned to.
 * @returns {{evidence: string, kind: 'defect'|'defensive'}|null} What was found, or null.
 */
function nullableUse(lines, index, variable) {
	const window = lines.slice(index, Math.min(lines.length, index + 16));

	/**
	 * The three shapes a caller uses, and what each one means for a read that raises.
	 *
	 *   `if (!x)` / `x === null`   the author expected a miss; whether it is a defect depends on what
	 *                              the branch does, which is why it is classified below.
	 *   `x ?? fallback` / `x ? …`  the author handled the miss inline, and since the read raises the
	 *                              handling is the defect itself — the fallback is unreachable.
	 *   `if (x)`                   the opposite reading, and the worse one: the branch is taken every
	 *                              time, so "is this code still free?" answers "no" for a free code.
	 *                              This is the shape that stops a resource being created at all, and a
	 *                              check that only looked for `!x` would miss every one of them.
	 */
	const falsy = [new RegExp(`!\\s*${variable}\\b`), new RegExp(`\\b${variable}\\s*===?\\s*null`)];
	const inline = [new RegExp(`\\b${variable}\\s*\\?\\?`), new RegExp(`\\b${variable}\\s*\\?[^.]`)];
	const truthy = [new RegExp(`if\\s*\\(\\s*${variable}\\s*[)&|]`)];

	for (let offset = 1; offset < window.length; offset++) {
		const line = window[offset];

		if (/catch\s*\(/.test(line) || /try\s*\{/.test(line)) return null;

		const evidence = `line ${index + offset + 1}: ${line.trim().slice(0, 110)}`;

		// The read raises, so a branch that consumes the value inline is already wrong.
		if (inline.some((pattern) => pattern.test(line)) || truthy.some((pattern) => pattern.test(line))) {
			return { evidence, kind: 'defect' };
		}

		if (!falsy.some((pattern) => pattern.test(line))) continue;

		// The branch's own body decides which kind this is: a throw means the author never expected
		// to reach it, anything else means absence is a state the code acts on. The window is offset
		// from the *call*, not from the file, which is the difference between reading the branch and
		// reading whatever happens to sit at the top of the file.
		const body = lines.slice(index + offset, Math.min(lines.length, index + offset + 6)).join('\n');

		return { evidence, kind: /throw\s+new/.test(body) ? 'defensive' : 'defect' };
	}

	return null;
}

const findings = [];
let calls = 0;

for (const root of ROOTS) {
	for (const file of sources(root)) {
		const text = read(file);
		if (!THROWING.test(text)) continue;

		const lines = text.split(/\r?\n/);

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			if (!THROWING.test(line) || FAIL_SOFT.test(line)) continue;
			// A comment that names the method is not a call.
			if (/^\s*(\*|\/\/)/.test(line)) continue;

			calls++;
			const variable = assignedTo(lines, index);
			if (!variable) continue;

			const evidence = nullableUse(lines, index, variable);
			if (!evidence) continue;

			findings.push({
				file: relative(ROOT, file),
				line: index + 1,
				variable,
				evidence: evidence.evidence,
				kind: evidence.kind
			});
		}
	}
}

const defects = findings.filter((finding) => finding.kind === 'defect');
const defensive = findings.filter((finding) => finding.kind === 'defensive');

/**
 * A method that promises null and delegates straight to a read that raises.
 *
 * The first version of this script looked only at call sites, and missed the shape one level up: a
 * method declared `Promise<X | null>` and documented as answering null, whose entire body is
 * `return await this.findOneByWhereOptions(...)`. Its contract is unkeepable — the read raises before
 * the method can answer — and every caller that branches on null is in the same position as the ones
 * this script was written for. The caller is not even in the same file, which is why a window around
 * the call site cannot see it.
 *
 * @param lines The file's lines.
 * @returns {Array<{line: number, method: string}>} The declarations whose body cannot keep them.
 */
function unkeepableNullableMethods(lines) {
	const found = [];
	const declaration = /(?:public\s+|private\s+|protected\s+)?async\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<[^;{]*\|\s*null\s*>/;

	for (let index = 0; index < lines.length; index++) {
		const match = declaration.exec(lines[index]);
		if (!match) continue;

		const body = lines.slice(index, Math.min(lines.length, index + 24)).join('\n');

		// Returning the throwing read is the defect. Going through the fail-soft pair is not, even
		// though it names a method the two share a prefix with, so the fail-soft spelling is excluded
		// rather than the whole family.
		const returnsThrowing = /return\s+(?:await\s+)?(?:this\.)?[\w.]*findOneBy(?:Where)?Options\s*\(/.test(body);
		const goesThroughPair = /return\s+(?:await\s+)?(?:this\.)?[\w.]*findOneOrFailBy/.test(body);
		const catches = /catch\s*\(/.test(body);

		if (returnsThrowing && !goesThroughPair && !catches) {
			found.push({ line: index + 1, method: match[1] });
		}
	}

	return found;
}

const unkeepable = [];

for (const root of ROOTS) {
	for (const file of sources(root)) {
		const text = read(file);
		if (!/Promise<[^;{]*\|\s*null\s*>/.test(text)) continue;

		for (const entry of unkeepableNullableMethods(text.split(/\r?\n/))) {
			unkeepable.push({ file: relative(ROOT, file), ...entry });
		}
	}
}

console.log('');
console.log('Nullable reads — a method that raises is not a method that answers null');
console.log('====================================================================');
console.log('');
console.log(`  ${calls} call(s) to the throwing reads across the programme's packages and the application`);
console.log(`  ${defects.length} treat absence as an ordinary answer, which is the defect`);
console.log(`  ${unkeepable.length} method(s) promise null and cannot answer it`);
console.log(`  ${defensive.length} guard against it and then throw, which is a branch that cannot be taken`);
console.log('');

if (defects.length) {
	console.log('  Absence treated as an answer:');
	for (const finding of defects) {
		console.log(`    ${finding.file}:${finding.line}  → ${finding.variable}`);
		console.log(`        ${finding.evidence}`);
	}
	console.log('');
}

if (unkeepable.length) {
	console.log('  Declared nullable, and the body raises instead:');
	for (const entry of unkeepable) {
		console.log(`    ${entry.file}:${entry.line}  → ${entry.method}() is declared to answer null`);
	}
	console.log('');
}

if (defensive.length) {
	console.log('  Dead branches — the read raises before the branch can run:');
	for (const finding of defensive) {
		console.log(`    ${finding.file}:${finding.line}  → ${finding.variable}  (${finding.evidence})`);
	}
	console.log('');
}

if (defects.length || unkeepable.length) {
	console.log('  The fail-soft pair is `findOneOrFailByOptions` / `findOneOrFailByWhereOptions`, whose');
	console.log('  result carries `success` instead of raising.');
}

const failed = defects.length > 0 || unkeepable.length > 0;

console.log('');
console.log(failed ? 'nullable read check: FAILED' : 'nullable read check: PASSED');

process.exit(failed ? 1 : 0);
