/**
 * The decorator runs of a TypeScript source file, read without a compiler.
 *
 * Two gates ask the same question of a controller or a resolver — what does the class state above itself, and
 * what does each member state above itself — and a guard or a permission is only meaningful when it is read
 * against the class it belongs to:
 *
 *   - `graphql-feature-gate-check.mjs` asks whether the gate a resolver states is read by the guard that enforces
 *     it, operation by operation;
 *   - `api-parity-check.mjs` asks whether a GraphQL root field asks the caller for at least the permission the
 *     REST route of the same concept asks for.
 *
 * The reading is textual, like the rest of `tools/scripts` (these gates install nothing):
 *
 *   - comments are stripped first, with the reader `subscription-parity-check.mjs` already uses, so a decorator
 *     that was commented out is not read as stated, and line numbers are preserved;
 *   - a decorator may span several lines (`@Permissions(PermissionsEnum.A, PermissionsEnum.B)` wraps, and
 *     `@Query(() => X, { name: 'y' })` carries parentheses of its own), so a run is read with balanced
 *     parentheses, and a parenthesis inside a string literal is not counted;
 *   - **every class keeps its own run.** A file may declare an input type or a DTO above the controller or the
 *     resolver it serves; the decorators above each `class` line belong to that class, and a member belongs to the
 *     class declared most recently above it. Reading only the first class of a file would attribute the resolver's
 *     own `@UseGuards(...)` to nothing — and a gate that loses a class-level guard reports a guarded operation as
 *     unguarded, which teaches a reader to ignore it.
 *
 * Parameter decorators (`@Args('id') id: ID`) are read as a run too and attached to whatever follows them. None of
 * the questions above is asked of them, so that costs nothing; it is stated so nobody reads it as a bug.
 *
 * Run from the repository root: `node --test tools/scripts/decorator-runs.test.mjs`
 */
import { stripComments } from './subscription-parity-check.mjs';

/** A class declaration at the start of a line (top-level), with the name it declares. */
const CLASS_DECLARATION = /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/;

/** A member declaration, with the name it declares: a method, an accessor or a property. */
const MEMBER_DECLARATION =
	/^(?:(?:public|private|protected|readonly|static|async|override|declare|get|set)\s+)*\*?\s*([A-Za-z_$][\w$]*)\s*[?!]?\s*[(<:=;]/;

/**
 * How many parentheses a text opens, net of the ones it closes, outside its string literals.
 *
 * @param {string} text
 * @returns {number}
 */
export function parenthesisBalance(text) {
	let depth = 0;
	let quote = null;

	for (let index = 0; index < text.length; index++) {
		const character = text[index];

		if (quote) {
			if (character === '\\') index++;
			else if (character === quote) quote = null;
			continue;
		}

		if (character === "'" || character === '"' || character === '`') quote = character;
		else if (character === '(') depth++;
		else if (character === ')') depth--;
	}

	return depth;
}

/**
 * Every class a source declares, with the decorators above it and the decorated members inside it.
 *
 * @param {string} source The file's text.
 * @returns {Array<{ name: string, line: number, declaration: string, decorators: string[],
 *   members: Array<{ name: string, line: number, decorators: string[] }> }>} One entry per class, in source order.
 *   `declaration` is the class line itself, which is where `extends CrudController` is read from; a member is listed
 *   only when at least one decorator stands above it.
 */
export function decoratedClasses(source) {
	const lines = stripComments(source).split(/\r?\n/);
	const classes = [];
	let current = null;
	let pending = [];
	let buffer = null;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const trimmed = line.trim();

		if (buffer !== null) {
			buffer += `\n${trimmed}`;

			if (parenthesisBalance(buffer) <= 0) {
				pending.push(buffer);
				buffer = null;
			}

			continue;
		}

		if (trimmed === '') continue;

		if (trimmed.startsWith('@')) {
			if (parenthesisBalance(trimmed) > 0) buffer = trimmed;
			else pending.push(trimmed);

			continue;
		}

		// Only a declaration at the start of a line opens a class: the repository declares its classes at the top
		// level, and a `class` keyword further in (a nested helper, a string) is not one of them.
		const declared = /^\s/.test(line) ? null : CLASS_DECLARATION.exec(trimmed);

		if (declared) {
			current = { name: declared[1], line: index + 1, declaration: trimmed, decorators: pending, members: [] };
			classes.push(current);
			pending = [];
			continue;
		}

		if (pending.length > 0) {
			if (current) {
				const named = MEMBER_DECLARATION.exec(trimmed);

				current.members.push({ name: named ? named[1] : '(anonymous)', line: index + 1, decorators: pending });
			}

			pending = [];
		}
	}

	return classes;
}

/**
 * Whether a decorator run states a decorator.
 *
 * @param {string[]} run The decorator run.
 * @param {string} name The decorator's name, without the `@`.
 * @returns {boolean}
 */
export function states(run, name) {
	return run.some((decorator) => decorator.startsWith(`@${name}(`));
}

/**
 * The guards a decorator run's `@UseGuards(...)` name, in the order they are written.
 *
 * @param {string[]} run The decorator run.
 * @returns {string[]} The guard class names.
 */
export function guardsOf(run) {
	return run
		.filter((decorator) => decorator.startsWith('@UseGuards('))
		.flatMap((decorator) => [...decorator.matchAll(/\b([A-Za-z_$][\w$]*Guard)\b/g)].map((match) => match[1]));
}
