#!/usr/bin/env node
/*
 * A provider Nest cannot read the constructor of is a provider Nest builds with nothing.
 *
 * Nest resolves a provider's dependencies from the `design:paramtypes` metadata TypeScript emits
 * *beside a decorated class*. A class that carries no decorator gets no such metadata — TypeScript
 * emits it only when the class has at least one decorator — so the container calls the constructor
 * with no arguments and every parameter is `undefined`. Nothing fails at boot, nothing fails at
 * compile time, and the class looks correct in review: the constructor names its dependencies, the
 * module provides them, and `experimentalDecorators` / `emitDecoratorMetadata` are on.
 *
 * What a caller sees is a failure inside the *base* class, far from the cause. `MerchantService`
 * extends the platform's tenant-aware CRUD service, so a store whose inherited repository is
 * `undefined` answers `Cannot read properties of undefined (reading 'metadata')` — on the REST route
 * and on the GraphQL field alike, because both reach the one service — while the twelve other
 * resources that share the base class keep working, which is what makes it look like a data problem.
 *
 * This script reads every class that extends a CRUD base class and requires `@Injectable()` on it.
 * The two base classes are the ones whose constructor this workspace's modules hand repositories to,
 * so a subclass of either is always a provider, and always one whose dependencies matter. An abstract
 * subclass is skipped: an abstract class is a base others extend, and Nest never constructs one.
 *
 * Usage:
 *   node tools/scripts/service-injectable-check.mjs [repoRoot]
 *
 * Exits 0 when every concrete CRUD subclass is injectable, 1 otherwise.
 */
'use strict';

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');

/**
 * The base classes whose constructor takes the repository pair.
 *
 * A subclass of either is a Nest provider by construction: the platform's modules list it in
 * `providers` and hand it two mappers. `CrudService` is included beside the tenant-aware one because
 * a service that does not scope on the tenant is still built over a store.
 */
const BASE_CLASSES = /\bextends\s+(?:[\w.]+\.)?(?:TenantAware)?CrudService\s*</;

/**
 * Where the script looks.
 *
 * The backend halves of the workspace. `packages/ui-core` declares a `CrudService` of its own — an
 * Angular HTTP client wrapper — and its subclasses are framework services whose decorator carries
 * `providedIn: 'root'`; measuring them here would be measuring a different class with the same name.
 */
const ROOTS = [join(ROOT, 'packages', 'core'), join(ROOT, 'packages', 'plugins'), join(ROOT, 'apps')];

/** Directories that hold no source. */
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', '.nx', 'tmp', 'migrations']);

/** Every `.ts` file under a directory, excluding specs and declarations. */
function sources(directory) {
	const found = [];

	let entries;
	try {
		entries = readdirSync(directory, { withFileTypes: true });
	} catch {
		return found;
	}

	for (const entry of entries) {
		const full = join(directory, entry.name);

		if (entry.isDirectory()) {
			if (SKIP_DIRECTORIES.has(entry.name)) continue;
			found.push(...sources(full));
			continue;
		}

		if (!entry.name.endsWith('.ts')) continue;
		if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.d.ts')) continue;

		found.push(full);
	}

	return found;
}

/** Reads a file, or the empty string when it cannot be read. */
function read(file) {
	try {
		return readFileSync(file, 'utf8');
	} catch {
		return '';
	}
}

/** How many brackets a line opens, ignoring the ones it closes. */
function openers(line) {
	return (line.match(/[([{]/g) ?? []).length;
}

/** How many brackets a line closes. */
function closers(line) {
	return (line.match(/[)\]}]/g) ?? []).length;
}

/** Whether a line is blank or part of a comment. */
function ignorable(line) {
	return line === '' || line.startsWith('*') || line.startsWith('/*') || line.startsWith('//') || line.startsWith('*/');
}

/**
 * The decorators belonging to the class declared on a line.
 *
 * A decorator's argument list can span lines, so the header is walked upwards from the class keyword:
 * a line that opens more brackets than it closes is the top of a decorator, and a line that closes
 * more than it opens is the tail of one. The walk stops at the first line that is neither, which is
 * what keeps a decorator belonging to the *previous* declaration from being read as this class's —
 * that mistake would silently excuse a class that has none.
 *
 * @param {string[]} lines The file, split.
 * @param {number} index The line the class keyword is on.
 * @returns {string[]} The decorator names found, nearest first.
 */
function decoratorsAbove(lines, index) {
	const found = [];
	let need = 0;

	for (let cursor = index - 1; cursor >= 0; cursor--) {
		const line = lines[cursor].trim();

		if (need === 0) {
			if (ignorable(line)) continue;

			// The tail of a decorator whose arguments are written across several lines.
			if (closers(line) > openers(line)) {
				need = closers(line) - openers(line);
				continue;
			}

			const decorator = /^@([A-Za-z_$][\w$]*)/.exec(line);
			if (decorator) found.push(decorator[1]);

			break;
		}

		// Inside a multi-line decorator: the line that opens it ends the header.
		need -= openers(line);
		if (need > 0) continue;

		const decorator = /^@([A-Za-z_$][\w$]*)/.exec(line);
		if (decorator) found.push(decorator[1]);

		break;
	}

	return found;
}

const offenders = [];
let scanned = 0;
let injectable = 0;

for (const root of ROOTS) {
	for (const file of sources(root)) {
		const text = read(file);
		if (!BASE_CLASSES.test(text)) continue;

		const lines = text.split(/\r?\n/);

		for (let index = 0; index < lines.length; index++) {
			const declaration = /^\s*export\s+(abstract\s+)?class\s+(\w+)/.exec(lines[index]);
			if (!declaration) continue;

			// An abstract subclass is a base for others; Nest constructs the concrete ones.
			if (declaration[1]) continue;

			const header = lines.slice(index, index + 4).join(' ');
			if (!BASE_CLASSES.test(header)) continue;

			scanned++;

			const decorators = decoratorsAbove(lines, index);

			if (decorators.includes('Injectable')) {
				injectable++;
			} else {
				offenders.push({
					file: relative(ROOT, file),
					line: index + 1,
					name: declaration[2],
					decorators
				});
			}
		}
	}
}

console.log('');
console.log('Injectable CRUD services — a provider Nest cannot read the constructor of');
console.log('========================================================================');
console.log('');
console.log(`  ${scanned} concrete class(es) extend a CRUD base class across the backend packages`);
console.log(`  ${injectable} carry @Injectable(), so Nest hands them the repositories they name`);
console.log(`  ${offenders.length} carry none, so Nest hands them nothing`);
console.log('');

if (offenders.length) {
	for (const offender of offenders) {
		const present = offender.decorators.length ? ` (decorated with @${offender.decorators.join(', @')})` : ' (undecorated)';
		console.log(`    ${offender.file}:${offender.line}  → ${offender.name}${present}`);
	}
	console.log('');
	console.log('  TypeScript emits `design:paramtypes` only beside a decorated class, so a class without');
	console.log('  `@Injectable()` is constructed with no arguments and every parameter it names is');
	console.log('  `undefined`. The failure surfaces inside the base class, on every protocol at once.');
	console.log('');
}

console.log(offenders.length ? 'service injectable check: FAILED' : 'service injectable check: PASSED');

process.exit(offenders.length ? 1 : 0);
