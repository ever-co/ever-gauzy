#!/usr/bin/env node
/**
 * Gate: a request body that updates a record never carries a default the client did not send.
 *
 * The mapped types of `@nestjs/mapped-types` and `@nestjs/swagger` (`PartialType`, `PickType`, `OmitType`,
 * `IntersectionType`) give the class they build a constructor that runs `inheritPropertyInitializers`: it
 * instantiates the parent DTO and copies every field initializer it finds onto the new instance. A route whose
 * `ValidationPipe` runs with `transform: true` builds its body with `plainToInstance`, which calls that
 * constructor - so a partial update that names only `metadata` reaches the service carrying every defaulted field
 * of the create DTO as well. `PUT /api/payment-collections/:id {metadata}` wrote `authorizedAmount`,
 * `capturedAmount`, `refundedAmount` and `canceledAmount` back to `'0'` (review R3-04), and the same mechanism
 * reset promotion and coupon usage counts and statuses, re-enabled disabled providers and switched a test-mode
 * payment provider to live (R3-05). Nothing in the suites saw it: the controller specs call the handlers with
 * plain objects and never go through the pipe.
 *
 * The fix is one mechanism, `WithoutInitializers` (`packages/common/src/lib/dto/without-initializers.ts`): a
 * subclass of the mapped class (or of the DTO) with the same validation, transformation and OpenAPI metadata, whose
 * constructor leaves the parent's defaults behind. This gate keeps it that way. For every class used as the body of a `PUT` or `PATCH`
 * route, and every body class named as an update or a patch on any route, it works out which fields
 * `new Body()` would already hold - the class's own initializers plus whatever its heritage copies in, through
 * `PartialType`, `PickType`, `OmitType`, `IntersectionType` and plain `extends` - and fails when that set is not
 * empty.
 *
 * Like the other gates in `static-checks.yml`, it runs with no install, so it reads the TypeScript lexically
 * rather than through the compiler. A heritage it cannot follow (a class-returning function other than the
 * mapped types, or a class it cannot resolve) is reported as unknown rather than passed silently.
 *
 * Run from the repository root:
 *   node tools/scripts/update-dto-initializer-check.mjs           the gate
 *   node tools/scripts/update-dto-initializer-check.mjs --report  every update body with what it inherits
 *   node tools/scripts/update-dto-initializer-check.mjs --json    the same as JSON
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCAN = ['packages', 'apps'].map((dir) => join(ROOT, dir));
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', 'coverage', '.nx', 'tmp', 'build', 'release']);

const args = new Set(process.argv.slice(2));
const REPORT = args.has('--report');
const JSON_OUT = args.has('--json');

/** The class factories whose constructor copies the parent's initializers, by the rule each applies. */
const MAPPED = new Set(['PartialType', 'PickType', 'OmitType', 'IntersectionType']);

/** The factory that builds the mapped class without the parent's initializers. */
const STRIPPING = new Set(['WithoutInitializers']);

/**
 * Body classes that may carry initializers, with the reason each one is meant to.
 *
 * Neither is a partial update of a stored record: each is the whole statement of an action, and the default is part
 * of what the action means when the client leaves the member out. A name left here after its class stops carrying a
 * default is reported, so the list cannot outlive its reason.
 */
const EXEMPT = new Map([
	[
		'SubmitTimesheetStatusDTO',
		'PUT /timesheet/submit is the submit/unsubmit action, not a record update: `status` defaults to "submit" by design'
	],
	[
		'CreateCampaignBudgetDTO',
		'PUT /campaigns/:id/budget sets or replaces the whole ceiling with the create shape (CampaignBudgetService.setBudget); ' +
			'`type` is the create default of that full statement, as it is on POST /campaign-budgets'
	]
]);

// ---------------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------------

/** Every TypeScript source under the scanned roots, skipping build output, specs and declaration files. */
function sourceFiles(dir, found = []) {
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		return found;
	}
	for (const entry of entries) {
		if (SKIP_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		let stat;
		try {
			stat = statSync(full);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			sourceFiles(full, found);
		} else if (
			entry.endsWith('.ts') &&
			!entry.endsWith('.d.ts') &&
			!entry.endsWith('.spec.ts') &&
			!entry.endsWith('.test.ts')
		) {
			found.push(full);
		}
	}
	return found;
}

const rel = (file) => relative(ROOT, file).split('\\').join('/');

// ---------------------------------------------------------------------------------------------------------------
// Lexing: a copy of the source with comments blanked and string, template and regex bodies masked, same length,
// so braces and parentheses can be counted on the mask and text read back from the original at the same offsets.
// ---------------------------------------------------------------------------------------------------------------

const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%<>~^]|^$|\breturn$|\btypeof$|\bcase$/;

/** @returns The masked copy of `source`. */
function mask(source) {
	const out = source.split('');
	const n = source.length;
	let i = 0;
	const templateDepth = [];
	let lastSignificant = '';

	const blank = (from, to) => {
		for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
	};
	const fill = (from, to) => {
		for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = 'x';
	};

	while (i < n) {
		const c = source[i];
		const next = source[i + 1];

		if (c === '/' && next === '/') {
			const end = source.indexOf('\n', i);
			const stop = end === -1 ? n : end;
			blank(i, stop);
			i = stop;
			continue;
		}
		if (c === '/' && next === '*') {
			const end = source.indexOf('*/', i + 2);
			const stop = end === -1 ? n : end + 2;
			blank(i, stop);
			i = stop;
			continue;
		}
		if (c === '"' || c === "'") {
			let k = i + 1;
			while (k < n && source[k] !== c && source[k] !== '\n') k += source[k] === '\\' ? 2 : 1;
			fill(i + 1, k);
			i = k + 1;
			lastSignificant = 'x';
			continue;
		}
		if (c === '`' || (c === '}' && templateDepth.length > 0 && templateDepth[templateDepth.length - 1] === 0)) {
			if (c === '}') templateDepth.pop();
			let k = i + 1;
			while (k < n && source[k] !== '`') {
				if (source[k] === '\\') {
					k += 2;
					continue;
				}
				if (source[k] === '$' && source[k + 1] === '{') break;
				k++;
			}
			fill(i + 1, k);
			if (source[k] === '$') {
				templateDepth.push(0);
				i = k + 2;
			} else {
				i = k + 1;
			}
			lastSignificant = 'x';
			continue;
		}
		if (c === '/') {
			const before = source.slice(Math.max(0, i - 8), i).trimEnd();
			const prev = before.slice(-1);
			if (REGEX_PREFIX.test(prev) || /\b(return|typeof|case)$/.test(before)) {
				let k = i + 1;
				let inClass = false;
				while (k < n && source[k] !== '\n') {
					if (source[k] === '\\') {
						k += 2;
						continue;
					}
					if (source[k] === '[') inClass = true;
					else if (source[k] === ']') inClass = false;
					else if (source[k] === '/' && !inClass) break;
					k++;
				}
				if (source[k] === '/') {
					fill(i + 1, k);
					i = k + 1;
					while (i < n && /[a-z]/i.test(source[i])) i++;
					lastSignificant = 'x';
					continue;
				}
			}
		}
		if (templateDepth.length > 0) {
			if (c === '{') templateDepth[templateDepth.length - 1]++;
			else if (c === '}') templateDepth[templateDepth.length - 1]--;
		}
		if (!/\s/.test(c)) lastSignificant = c;
		i++;
	}
	void lastSignificant;
	return out.join('');
}

/** The index of the bracket that closes the one at `open` (`(`, `[`, `{` or `<`), on the masked text. */
function matching(masked, open) {
	const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
	const opener = masked[open];
	const closer = pairs[opener];
	let depth = 0;
	for (let k = open; k < masked.length; k++) {
		const ch = masked[k];
		if (opener === '<' && ch === '=' && masked[k + 1] === '>') {
			k++;
			continue;
		}
		if (ch === opener) depth++;
		else if (ch === closer) {
			depth--;
			if (depth === 0) return k;
		}
	}
	return -1;
}

// ---------------------------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------------------------

/** @returns `{ local -> { imported, module } }` for the named imports of a file. */
function importsOf(source) {
	const found = new Map();
	const named = /import\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
	let match;
	while ((match = named.exec(source)) !== null) {
		for (const part of match[1].split(',')) {
			const spec = part.replace(/\btype\s+/, '').trim();
			if (!spec) continue;
			const [imported, local] = spec.split(/\s+as\s+/).map((s) => s.trim());
			found.set(local ?? imported, { imported, module: match[2] });
		}
	}
	return found;
}

/** @returns The re-exports of a file: `{ named: Map(exported -> { imported, module }), stars: [module] }`. */
function reExportsOf(source) {
	const named = new Map();
	const stars = [];
	const namedRe = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
	const starRe = /export\s+\*\s+from\s*['"]([^'"]+)['"]/g;
	let match;
	while ((match = namedRe.exec(source)) !== null) {
		for (const part of match[1].split(',')) {
			const spec = part.replace(/\btype\s+/, '').trim();
			if (!spec) continue;
			const [imported, exported] = spec.split(/\s+as\s+/).map((s) => s.trim());
			named.set(exported ?? imported, { imported, module: match[2] });
		}
	}
	while ((match = starRe.exec(source)) !== null) stars.push(match[1]);
	return { named, stars };
}

/**
 * The offset at which a class member's declaration starts, past the decorators that lead it.
 *
 * Read on the masked text, so a comment or a string argument of a decorator cannot be mistaken for structure.
 */
function declarationOffset(masked) {
	let k = 0;
	const skipSpace = () => {
		while (k < masked.length && /\s/.test(masked[k])) k++;
	};
	skipSpace();
	for (;;) {
		const decorator = /^@[A-Za-z_$][\w$.]*/.exec(masked.slice(k));
		if (!decorator) return k;
		k += decorator[0].length;
		skipSpace();
		if (masked[k] === '<') {
			const close = matching(masked, k);
			k = close === -1 ? k + 1 : close + 1;
			skipSpace();
		}
		if (masked[k] === '(') {
			const close = matching(masked, k);
			k = close === -1 ? masked.length : close + 1;
		}
		skipSpace();
	}
}

/**
 * The instance fields a class body initializes, from its property declarations and from `this.x =` in its
 * constructor.
 *
 * @returns `{ initialized: Set<string>, declared: Set<string> }`.
 */
function membersOf(source, masked, bodyStart, bodyEnd) {
	const initialized = new Set();
	const declared = new Set();
	let segmentStart = bodyStart + 1;
	let k = bodyStart + 1;

	const consume = (from, to) => {
		const text = source.slice(from, to);
		const textMasked = masked.slice(from, to);
		if (!text.trim()) return;
		const offset = declarationOffset(textMasked);
		const decl = text.slice(offset);
		const declMasked = textMasked.slice(offset);

		const modifiers = /^((?:(?:public|private|protected|readonly|declare|static|override|abstract|accessor)\s+)*)/.exec(
			decl
		)[1];
		const head = decl.slice(modifiers.length);
		const headMasked = declMasked.slice(modifiers.length);

		if (/^constructor\s*\(/.test(head)) {
			const assign = /\bthis\.([A-Za-z_$][\w$]*)\s*=(?![=>])/g;
			let match;
			while ((match = assign.exec(headMasked)) !== null) initialized.add(match[1]);
			return;
		}
		if (/\bstatic\b|\bdeclare\b|\babstract\b/.test(modifiers)) return;

		const name = /^(?:get\s+|set\s+)?(?:async\s+)?\*?\s*(\[[^\]]*\]|[A-Za-z_$][\w$]*|'[^']*'|"[^"]*")/.exec(head);
		if (!name) return;
		const afterName = headMasked.slice(name[0].length).replace(/^[?!]/, '').trimStart();
		if (/^(get|set)\s/.test(head) || afterName.startsWith('(') || afterName.startsWith('<')) return; // method

		const key = name[1].replace(/^['"]|['"]$/g, '');
		declared.add(key);

		// The first `=` outside brackets, that is not part of `=>`, `==`, `>=`, `<=` or `!=`.
		let depth = 0;
		for (let p = 0; p < afterName.length; p++) {
			const ch = afterName[p];
			if ('([{'.includes(ch)) depth++;
			else if (')]}'.includes(ch)) depth--;
			else if (ch === '=' && depth === 0) {
				const prev = afterName[p - 1];
				const nxt = afterName[p + 1];
				if (nxt === '>' || nxt === '=' || prev === '=' || prev === '!' || prev === '<' || prev === '>') continue;
				initialized.add(key);
				break;
			}
		}
	};

	while (k < bodyEnd) {
		const ch = masked[k];
		if (ch === '(' || ch === '[') {
			const close = matching(masked, k);
			k = close === -1 ? bodyEnd : close + 1;
			continue;
		}
		if (ch === '{') {
			const close = matching(masked, k);
			const end = close === -1 ? bodyEnd : close + 1;
			// A brace that follows `=` belongs to an initializer; anything else closes a method or accessor body.
			const before = masked.slice(segmentStart, k).trimEnd();
			if (/=$|=>$/.test(before) || /[=(,:?]\s*$/.test(before)) {
				k = end;
				continue;
			}
			consume(segmentStart, end);
			segmentStart = end;
			k = end;
			continue;
		}
		if (ch === ';') {
			consume(segmentStart, k);
			segmentStart = k + 1;
		}
		k++;
	}
	consume(segmentStart, bodyEnd);
	return { initialized, declared };
}

/** The classes a file declares: `{ name, heritage, heritageMasked, initialized, declared, start }`. */
function classesOf(source, masked) {
	const found = [];
	const classRe = /\bclass\s+([A-Za-z_$][\w$]*)/g;
	let match;
	while ((match = classRe.exec(masked)) !== null) {
		const name = match[1];
		let k = match.index + match[0].length;
		while (/\s/.test(masked[k] ?? '')) k++;
		if (masked[k] === '<') {
			const close = matching(masked, k);
			if (close === -1) continue;
			k = close + 1;
		}
		let heritage = null;
		let heritageMasked = null;
		let bodyStart = -1;
		const rest = masked.slice(k);
		const ext = /^\s*extends\s+/.exec(rest);
		let cursor = k + (ext ? ext[0].length : 0);
		const hStart = cursor;
		for (; cursor < masked.length; cursor++) {
			const ch = masked[cursor];
			if (ch === '(' || ch === '[' || ch === '<') {
				const close = matching(masked, cursor);
				if (close === -1) break;
				cursor = close;
				continue;
			}
			if (ch === '{') {
				bodyStart = cursor;
				break;
			}
			if (/\bimplements\b/.test(masked.slice(cursor, cursor + 11)) && /\s/.test(masked[cursor - 1])) {
				const brace = masked.indexOf('{', cursor);
				// skip the implements list up to the body brace, which may follow generic arguments
				let p = cursor;
				for (; p < masked.length; p++) {
					if (masked[p] === '<') {
						const close = matching(masked, p);
						if (close !== -1) p = close;
						continue;
					}
					if (masked[p] === '{') break;
				}
				bodyStart = p === masked.length ? brace : p;
				break;
			}
		}
		if (bodyStart === -1) continue;
		if (ext) {
			const end = (() => {
				const text = masked.slice(hStart, bodyStart);
				const imp = text.search(/\simplements\s/);
				return imp === -1 ? bodyStart : hStart + imp;
			})();
			heritage = source.slice(hStart, end).trim();
			heritageMasked = masked.slice(hStart, end).trim();
		}
		const bodyEnd = matching(masked, bodyStart);
		if (bodyEnd === -1) continue;
		const { initialized, declared } = membersOf(source, masked, bodyStart, bodyEnd);
		found.push({ name, heritage, heritageMasked, initialized, declared, start: match.index, bodyStart, bodyEnd });
	}
	return found;
}

// ---------------------------------------------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------------------------------------------

const files = new Map(); // abs path -> { source, masked, classes, imports, reExports }

function load(file) {
	if (files.has(file)) return files.get(file);
	let source;
	try {
		source = readFileSync(file, 'utf8');
	} catch {
		files.set(file, null);
		return null;
	}
	const masked = mask(source);
	const entry = {
		file,
		source,
		masked,
		classes: /\bclass\s/.test(masked) ? classesOf(source, masked) : [],
		imports: importsOf(source),
		reExports: reExportsOf(source)
	};
	files.set(file, entry);
	return entry;
}

/** `@gauzy/*` package name -> its entry file, from the root tsconfig's paths. */
const PATHS = (() => {
	const map = new Map();
	try {
		const text = readFileSync(join(ROOT, 'tsconfig.json'), 'utf8');
		const re = /"(@gauzy\/[^"]+)"\s*:\s*\[\s*"([^"]+)"/g;
		let match;
		while ((match = re.exec(text)) !== null) map.set(match[1], join(ROOT, match[2]));
	} catch {
		/* no tsconfig: package imports stay unresolved */
	}
	return map;
})();

function resolveModule(fromFile, spec) {
	let base;
	if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
	else if (PATHS.has(spec)) return PATHS.get(spec);
	else return null;
	for (const candidate of [`${base}.ts`, join(base, 'index.ts'), base]) {
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

const exportCache = new Map();

/** The class a module exports under `name`, following barrels. */
function exportedClass(file, name, seen = new Set()) {
	const key = `${file}#${name}`;
	if (exportCache.has(key)) return exportCache.get(key);
	if (seen.has(key)) return null;
	seen.add(key);
	const entry = load(file);
	let result = null;
	if (entry) {
		const own = entry.classes.find((c) => c.name === name);
		if (own) result = { entry, cls: own };
		if (!result) {
			const named = entry.reExports.named.get(name);
			if (named) {
				const target = resolveModule(file, named.module);
				if (target) result = exportedClass(target, named.imported, seen);
			}
		}
		if (!result) {
			// `import { X } from './x'; export { X };`
			const imported = entry.imports.get(name);
			if (imported && new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*;`).test(entry.masked)) {
				const target = resolveModule(file, imported.module);
				if (target) result = exportedClass(target, imported.imported, seen);
			}
		}
		if (!result) {
			for (const star of entry.reExports.stars) {
				const target = resolveModule(file, star);
				if (!target) continue;
				result = exportedClass(target, name, seen);
				if (result) break;
			}
		}
	}
	exportCache.set(key, result);
	return result;
}

/** The class an identifier names inside `entry`, or `{ external }` when it comes from outside the workspace. */
function resolveClass(entry, name) {
	const own = entry.classes.find((c) => c.name === name);
	if (own) return { entry, cls: own };
	const imported = entry.imports.get(name);
	if (!imported) return null;
	const target = resolveModule(entry.file, imported.module);
	if (!target) return { external: imported.module };
	return exportedClass(target, imported.imported);
}

// ---------------------------------------------------------------------------------------------------------------
// Heritage expressions
// ---------------------------------------------------------------------------------------------------------------

/**
 * Parses a heritage expression: an identifier (optionally dotted and generic), a call of one, an array literal of
 * string keys (`['a', 'b'] as const`), or anything else (kept as raw text).
 */
function parseExpression(text) {
	let pos = 0;
	const ws = () => {
		while (pos < text.length && /\s/.test(text[pos])) pos++;
	};
	const balanced = (open) => {
		const close = matching(mask(text), open);
		return close === -1 ? text.length : close;
	};

	function expr() {
		ws();
		if (text[pos] === '[') {
			const close = balanced(pos);
			const inner = text.slice(pos + 1, close);
			pos = close + 1;
			ws();
			if (text.startsWith('as const', pos)) pos += 'as const'.length;
			const keys = [...inner.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
			return { kind: 'keys', keys };
		}
		const id = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/.exec(text.slice(pos));
		if (!id) {
			const start = pos;
			// skip one argument
			let depth = 0;
			while (pos < text.length) {
				const ch = text[pos];
				if ('([{'.includes(ch)) depth++;
				else if (')]}'.includes(ch)) {
					if (depth === 0) break;
					depth--;
				} else if (ch === ',' && depth === 0) break;
				pos++;
			}
			return { kind: 'other', text: text.slice(start, pos).trim() };
		}
		pos += id[0].length;
		ws();
		if (text[pos] === '<') {
			pos = balanced(pos) + 1;
			ws();
		}
		if (text[pos] === '(') {
			const close = balanced(pos);
			const argsText = text.slice(pos + 1, close);
			pos = close + 1;
			return { kind: 'call', callee: id[0], args: splitArgs(argsText).map((a) => parseExpression(a)) };
		}
		return { kind: 'ref', name: id[0] };
	}

	return expr();
}

function splitArgs(text) {
	const out = [];
	const masked = mask(text);
	let depth = 0;
	let start = 0;
	for (let k = 0; k < masked.length; k++) {
		const ch = masked[k];
		if ('([{<'.includes(ch)) {
			if (ch === '<' && !/[A-Za-z_$\]]/.test(masked[k - 1] ?? '')) continue;
			depth++;
		} else if (')]}>'.includes(ch)) {
			if (ch === '>' && masked[k - 1] === '=') continue;
			depth--;
		} else if (ch === ',' && depth === 0) {
			out.push(text.slice(start, k));
			start = k + 1;
		}
	}
	if (text.slice(start).trim()) out.push(text.slice(start));
	return out;
}

// ---------------------------------------------------------------------------------------------------------------
// What `new Body()` holds
// ---------------------------------------------------------------------------------------------------------------

const classCache = new Map();

/**
 * The fields an instance of the class holds before any request field is assigned.
 *
 * @returns `{ keys: Map<field, origin>, unknown: string[] }` where `origin` names the class that declares the
 *   initializer and `unknown` lists the heritage the analysis could not follow.
 */
function instanceDefaults(entry, cls, stack = new Set()) {
	const key = `${entry.file}#${cls.name}#${cls.start}`;
	if (classCache.has(key)) return classCache.get(key);
	if (stack.has(key)) return { keys: new Map(), unknown: [`cycle at ${cls.name}`] };
	stack.add(key);
	const keys = new Map();
	const unknown = [];
	if (cls.heritage) {
		const inherited = expressionDefaults(entry, parseExpression(cls.heritage), stack);
		for (const [k, v] of inherited.keys) keys.set(k, v);
		unknown.push(...inherited.unknown);
	}
	for (const field of cls.initialized) keys.set(field, `${cls.name} (${rel(entry.file)})`);
	const result = { keys, unknown };
	classCache.set(key, result);
	stack.delete(key);
	return result;
}

function expressionDefaults(entry, node, stack) {
	if (node.kind === 'ref') {
		const name = node.name.split('.').pop();
		const target = resolveClass(entry, name);
		if (!target) return { keys: new Map(), unknown: [`unresolved class ${node.name} in ${rel(entry.file)}`] };
		if (target.external) return { keys: new Map(), unknown: [] }; // a class from outside the workspace
		return instanceDefaults(target.entry, target.cls, stack);
	}
	if (node.kind === 'call') {
		const callee = node.callee.split('.').pop();
		if (STRIPPING.has(callee)) return { keys: new Map(), unknown: [] };
		if (MAPPED.has(callee)) {
			const [first, ...rest] = node.args;
			if (callee === 'IntersectionType') {
				const keys = new Map();
				const unknown = [];
				for (const arg of node.args) {
					const part = expressionDefaults(entry, arg, stack);
					for (const [k, v] of part.keys) keys.set(k, v);
					unknown.push(...part.unknown);
				}
				return { keys, unknown };
			}
			const base = first ? expressionDefaults(entry, first, stack) : { keys: new Map(), unknown: [] };
			if (callee === 'PartialType') return base;
			const listed = rest.find((a) => a.kind === 'keys');
			if (!listed) return { keys: base.keys, unknown: [...base.unknown, `${callee} keys not literal in ${rel(entry.file)}`] };
			const keys = new Map(
				[...base.keys].filter(([k]) => (callee === 'PickType' ? listed.keys.includes(k) : !listed.keys.includes(k)))
			);
			return { keys, unknown: base.unknown };
		}
		return { keys: new Map(), unknown: [`class factory ${node.callee}(...) in ${rel(entry.file)}`] };
	}
	return { keys: new Map(), unknown: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// The bodies that update a record
// ---------------------------------------------------------------------------------------------------------------

/** The handlers of a controller with their decorators and parameters. */
function handlersOf(entry, cls) {
	const { source, masked } = entry;
	const found = [];
	let segmentStart = cls.bodyStart + 1;
	let k = cls.bodyStart + 1;
	while (k < cls.bodyEnd) {
		const ch = masked[k];
		if (ch === '(' || ch === '[') {
			const close = matching(masked, k);
			k = close === -1 ? cls.bodyEnd : close + 1;
			continue;
		}
		if (ch === '{') {
			const close = matching(masked, k);
			const end = close === -1 ? cls.bodyEnd : close + 1;
			const before = masked.slice(segmentStart, k).trimEnd();
			if (/[=(,:?]$|=>$/.test(before)) {
				k = end;
				continue;
			}
			const text = source.slice(segmentStart, k);
			const textMasked = masked.slice(segmentStart, k);
			const offset = declarationOffset(textMasked);
			const decl = textMasked.slice(offset);
			const name = /^(?:(?:public|private|protected|async|override)\s+)*([A-Za-z_$][\w$]*)\s*\(/.exec(decl);
			if (name) {
				const decorators = text.slice(0, offset);
				const paramsOpen = segmentStart + offset + decl.indexOf('(');
				const paramsClose = matching(masked, paramsOpen);
				found.push({
					name: name[1],
					decorators,
					params: source.slice(paramsOpen + 1, paramsClose),
					line: source.slice(0, segmentStart + offset).split('\n').length
				});
			}
			segmentStart = end;
			k = end;
			continue;
		}
		if (ch === ';') segmentStart = k + 1;
		k++;
	}
	return found;
}

/** Whether a decorator block runs a `ValidationPipe` with `transform: true`, or `null` when it states no pipe. */
function transformOf(text) {
	const pipes = [
		...text.matchAll(/(?:UseValidationPipe|new\s+ValidationPipe)\s*\(\s*(\{[\s\S]*?\})?\s*\)/g)
	];
	if (pipes.length === 0) return null;
	// `ValidationPipe` hands the handler the instance when `transform` is on. With it off it still builds the
	// instance to validate it, and when any validator option is set (`whitelist`, `forbidNonWhitelisted`, ...) it
	// returns `classToPlain(instance)` - defaults included - instead of the body it was given. Only a pipe with no
	// validator option at all passes the client's body through untouched.
	const PIPE_ONLY = new Set([
		'transform',
		'disableErrorMessages',
		'errorHttpStatusCode',
		'expectedType',
		'transformOptions',
		'exceptionFactory',
		'validatorPackage',
		'transformerPackage',
		'validateCustomDecorators',
		'errorFormat'
	]);
	return pipes.some((p) => {
		const options = p[1] ?? '';
		if (/transform\s*:\s*true/.test(options)) return true;
		const keys = [...options.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]);
		return keys.some((key) => !PIPE_ONLY.has(key));
	});
}

const UPDATE_NAME = /(^|[a-z])(Update|Patch)[A-Z]|^(Update|Patch)/;

const bodies = []; // { file, controller, handler, verb, path, line, type, transform }
const allFiles = SCAN.flatMap((dir) => sourceFiles(dir));

for (const file of allFiles) {
	if (!file.endsWith('.controller.ts')) continue;
	const entry = load(file);
	if (!entry) continue;
	for (const cls of entry.classes) {
		const classDecorators = entry.source.slice(Math.max(0, entry.source.lastIndexOf('\n}', cls.start)), cls.start);
		const classTransform = transformOf(classDecorators);
		for (const handler of handlersOf(entry, cls)) {
			const verb = /@(Put|Patch|Post|Delete)\s*\(\s*(?:['"]([^'"]*)['"])?/.exec(handler.decorators);
			if (!verb) continue;
			// `@Body(...) name: Type` or `@Body(...) { a, b }: Type`; an inline object type or an interface is `Object`
			// at runtime, which `plainToInstance` does not construct, so only a class name can carry a default.
			const body = /@Body\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)\s*(?:public\s+|readonly\s+)?(?:[A-Za-z_$][\w$]*|\{[^}]*\})\s*\??\s*:\s*([A-Za-z_$][\w$]*)(\s*\[\])?/.exec(
				handler.params
			);
			if (!body || body[3]) continue;
			const type = body[2];
			const isUpdateVerb = verb[1] === 'Put' || verb[1] === 'Patch';
			if (!isUpdateVerb && !UPDATE_NAME.test(type)) continue;
			const paramTransform = transformOf(body[1]);
			const routeTransform = transformOf(handler.decorators);
			const transform = paramTransform ?? routeTransform ?? classTransform ?? false;
			bodies.push({
				file,
				entry,
				controller: cls.name,
				handler: handler.name,
				verb: verb[1].toUpperCase(),
				path: verb[2] ?? '',
				line: handler.line,
				type,
				transform
			});
		}
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------------------------------------------

const byClass = new Map(); // "file#Class" -> { name, file, keys, unknown, routes: [] }
const unresolved = [];

/**
 * The interface and type-alias names the workspace declares. A body typed with one of them is `Object` at runtime,
 * which `plainToInstance` copies rather than constructs, so it cannot carry a default.
 */
const TYPE_NAMES = (() => {
	const names = new Set(['QueryDeepPartialEntity', 'DeepPartial', 'Record', 'Partial', 'Omit', 'Pick']);
	const declaration = /\b(?:interface|type)\s+([A-Za-z_$][\w$]*)/g;
	for (const file of allFiles) {
		let text;
		try {
			text = readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		if (!/\b(?:interface|type)\s/.test(text)) continue;
		let match;
		while ((match = declaration.exec(text)) !== null) names.add(match[1]);
	}
	return names;
})();

for (const body of bodies) {
	const target = resolveClass(body.entry, body.type);
	if (!target || target.external) {
		const primitive = /^[a-z]/.test(body.type) || ['Object', 'String', 'Number', 'Boolean', 'Array'].includes(body.type);
		if (!primitive && !TYPE_NAMES.has(body.type)) {
			unresolved.push(`${rel(body.file)}:${body.line} ${body.verb} ${body.handler}(${body.type})`);
		}
		continue;
	}
	const id = `${target.entry.file}#${target.cls.name}`;
	if (!byClass.has(id)) {
		const defaults = instanceDefaults(target.entry, target.cls);
		byClass.set(id, {
			name: target.cls.name,
			file: rel(target.entry.file),
			keys: defaults.keys,
			unknown: [...new Set(defaults.unknown)],
			routes: []
		});
	}
	byClass.get(id).routes.push({
		route: `${body.verb} ${body.path}`.trim(),
		controller: `${rel(body.file)}:${body.line}`,
		handler: `${body.controller}.${body.handler}`,
		transform: body.transform
	});
}

const rows = [...byClass.values()].sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
const offending = rows.filter((row) => row.keys.size > 0 && !EXEMPT.has(row.name));
const staleExemptions = [...EXEMPT.keys()].filter((name) => !rows.some((row) => row.name === name && row.keys.size > 0));

if (JSON_OUT) {
	console.log(
		JSON.stringify(
			{
				bodies: rows.map((row) => ({ ...row, keys: Object.fromEntries(row.keys) })),
				unresolved
			},
			null,
			2
		)
	);
	process.exit(0);
}

if (REPORT) {
	for (const row of rows.filter((r) => r.keys.size > 0)) {
		console.log(`${row.name}  (${row.file})`);
		console.log(`  defaults: ${[...row.keys.keys()].join(', ')}`);
		for (const route of row.routes) {
			console.log(`  ${route.route}  ${route.handler}  transform=${route.transform}  ${route.controller}`);
		}
	}
	console.log('');
	console.log(`${rows.length} update body class(es), ${rows.filter((r) => r.keys.size > 0).length} carrying defaults.`);
	const unknownRows = rows.filter((r) => r.unknown.length > 0);
	if (unknownRows.length) {
		console.log(`${unknownRows.length} with heritage the analysis could not follow:`);
		for (const row of unknownRows) console.log(`  ${row.name}: ${row.unknown.join('; ')}`);
	}
	if (unresolved.length) {
		console.log(`${unresolved.length} body type(s) not resolved to a workspace class:`);
		for (const line of unresolved) console.log(`  ${line}`);
	}
	process.exit(0);
}

if (offending.length > 0 || staleExemptions.length > 0) {
	console.error('FAILED — update request bodies that carry defaults the client did not send:');
	for (const row of offending) {
		console.error(`  ${row.name} (${row.file})`);
		for (const [field, origin] of row.keys) console.error(`    ${field}  <- initializer in ${origin}`);
		for (const route of row.routes) console.error(`    used by ${route.route} ${route.handler} (${route.controller})`);
	}
	for (const name of staleExemptions) console.error(`  exemption for ${name} no longer needed: remove it from EXEMPT`);
	console.error('');
	console.error(
		'Build an update body as `WithoutInitializers(PartialType(CreateXDTO))` (packages/common/src/lib/dto/' +
			'without-initializers.ts, exported from @gauzy/common) - or wrap whatever mapped type or DTO it extends - and' +
			' declare no initializer on the update class itself.'
	);
	process.exit(1);
}

const unknownCount = rows.filter((r) => r.unknown.length > 0).length;
const exemptedCount = rows.filter((r) => r.keys.size > 0 && EXEMPT.has(r.name)).length;
console.log(
	`PASSED — ${rows.length} update request body class(es) across ${bodies.length} route(s); none carries a default` +
		(exemptedCount ? ` (${exemptedCount} exempted action bodies, listed in the gate)` : '') +
		'.' +
		(unknownCount ? ` ${unknownCount} have heritage the gate could not follow (--report lists them).` : '')
);
