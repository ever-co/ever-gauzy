#!/usr/bin/env node
/**
 * Gate: the schema and the resolvers must agree on what exists, in both directions.
 *
 * `@nestjs/graphql` builds the schema at boot from the SDL plus the resolver metadata, and it does not
 * tolerate the two disagreeing:
 *
 *   - a `@ResolveField('x')` on a class whose `@Resolver('T')` type does not declare `x` stops the
 *     application from starting at all — `OrderLineInvoice.invoiceLinks defined in resolvers, but not in
 *     schema` — which is a boot failure, not a runtime refusal;
 *   - a `@Query('x')` or `@Mutation('x')` that no root type declares is a field every caller is told does
 *     not exist, while the method that was written for it sits unreachable;
 *   - a root field the schema declares and no resolver implements is answered as if it existed — with
 *     `null`, or with a non-null violation — so a client cannot tell a broken field from an empty one.
 *
 * This is the static half of that contract. The composed schema at
 * `packages/core/src/lib/graphql/schema/schema.graphql` is what the endpoint serves — it is generated
 * from the plugin schema extensions — so it is the truth this gate reads, and no Nest context is needed
 * to compare the two.
 *
 * Both halves of the surface are read: the plugins, and the platform's own resolvers under
 * `packages/core/src/lib`, because a root field bound in either place is bound.
 *
 * Run from the repository root: `node tools/scripts/graphql-field-binding-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');
const PLUGINS = join(ROOT, 'packages', 'plugins');

/**
 * The SDL, with descriptions removed.
 *
 * GraphQL allows two description forms and this schema uses both — the block `"""…"""` and the
 * single-line `"…"` written above a field — and a description's lines are indented like the field they
 * document, so reading fields without removing them first invents fields out of prose.
 */
const schema = readFileSync(SDL, 'utf8')
	.replace(/"""(?:[\s\S]*?)"""/g, '')
	.replace(/^[ \t]*"(?:[^"\\]|\\.)*"[ \t]*$/gm, '')
	.replace(/^[ \t]*#.*$/gm, '');

/** The text between the brace at `open` and the brace that closes it. */
function braceBody(open) {
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

/** Every body the schema gives a type: its own declaration, plus each `extend` of it. */
function typeBodies(name) {
	const pattern = new RegExp(`^(?:extend\\s+)?(?:type|interface)\\s+${name}\\b[^{]*\\{`, 'gm');
	const bodies = [];

	for (const block of schema.matchAll(pattern)) {
		const body = braceBody(schema.indexOf('{', block.index));
		if (body !== null) bodies.push(body);
	}

	return bodies;
}

/**
 * The field names declared directly in a type body.
 *
 * Depth is tracked rather than indentation matched: a field's arguments sit inside `( … )` — and this
 * schema documents them on their own indented lines — so matching by indentation reads `data` and
 * `filter` as fields of `Query` instead of arguments of one field on it.
 */
function fieldsOf(body) {
	const names = [];
	let braces = 0;
	let parens = 0;

	for (const line of body.split('\n')) {
		if (braces === 0 && parens === 0) {
			const field = /^\s*([A-Za-z_]\w*)\s*[(:]/.exec(line);
			if (field) names.push(field[1]);
		}
		for (const character of line) {
			if (character === '{') braces++;
			else if (character === '}') braces--;
			else if (character === '(') parens++;
			else if (character === ')') parens--;
		}
	}

	return names;
}

/** The field names a root type declares, `extend type` blocks included. */
function rootFields(type) {
	return new Set(typeBodies(type).flatMap((body) => fieldsOf(body)));
}

/**
 * Each field a type body declares, with the text of its own declaration — arguments included.
 *
 * `fieldsOf` answers *whether* a field exists; the soft-delete agreement below needs the field's own arguments,
 * and an argument belongs to the field whose parentheses enclose it. A field begins on a line at the body's own
 * indentation and its arguments follow on deeper ones, so the indent is *derived* from the body rather than
 * assumed: the snapshot indents `Query` with two spaces, and a reader written for tabs found none of its 671
 * fields while reporting success.
 *
 * The caller compares this function's count against `fieldsOf`'s and refuses to run when they disagree, so a
 * reader that stops matching is a failure rather than a vacuous pass — the failure mode two other gates in this
 * repository were written to stop repeating.
 */
function fieldTexts(type) {
	const declared = [];

	for (const body of typeBodies(type)) {
		const lines = body.split('\n');
		const fieldPattern = /^(\s+)([A-Za-z_]\w*)\s*[(:]/;
		const indent = lines.map((line) => fieldPattern.exec(line)?.[1]).find((found) => found !== undefined);

		if (indent === undefined) continue;

		let current = null;

		for (const line of lines) {
			const start = fieldPattern.exec(line);

			if (start && start[1] === indent) {
				current = { name: start[2], text: line };
				declared.push(current);
			} else if (current) {
				current.text += '\n' + line;
			}
		}
	}

	return declared;
}

/** The text the schema gives each field of a root type, keyed by field name. */
function declaredFieldTexts(type) {
	const texts = new Map();
	for (const field of fieldTexts(type)) texts.set(field.name, (texts.get(field.name) ?? '') + field.text);
	return texts;
}

/** The index of the `)` closing the call opened at `open`, skipping string literals. */
function closingParen(text, open) {
	let depth = 0;
	let quote = null;

	for (let index = open; index < text.length; index++) {
		const character = text[index];
		if (quote) {
			if (character === '\\') {
				index++;
				continue;
			}
			if (character === quote) quote = null;
			continue;
		}
		if (character === "'" || character === '"' || character === '`') {
			quote = character;
			continue;
		}
		if (character === '(') depth++;
		else if (character === ')') {
			depth--;
			if (depth === 0) return index;
		}
	}

	return -1;
}

/** Whether a type declares a field of that name. */
function declares(typeName, field) {
	const bodies = typeBodies(typeName);
	if (bodies.length === 0) return 'missing-type';
	return bodies.some((body) => fieldsOf(body).includes(field)) ? 'yes' : 'missing-field';
}

/**
 * The type a `@Resolver(...)` decorator names.
 *
 * Two spellings are in use: the quoted SDL name, and the arrow form pointing at the class that carries
 * the `@ObjectType`. The arrow form gives a class name rather than an SDL name, and the two are only
 * usually the same, so the class's own `@ObjectType('…')` is preferred when the slice declares one.
 */
function resolverType(argument, members) {
	const quoted = /'([^']+)'/.exec(argument);
	if (quoted) return quoted[1];

	const arrow = /=>\s*([A-Za-z_]\w*)/.exec(argument);
	if (!arrow) return null;

	const objectType = new RegExp(
		`@ObjectType\\(\\s*'([^']+)'\\s*\\)[\\s\\S]{0,400}?\\bclass\\s+${arrow[1]}\\b`
	).exec(members);

	return objectType ? objectType[1] : arrow[1];
}

/**
 * The resolver classes in a source file, each with the slice of source it owns.
 *
 * A file may hold several: `OperationResolver` and `OperationStepResolver` share one, and reading them
 * as one class asks whether `OperationStep`'s fields are declared on `Operation` — a question that is
 * wrong twice over. The slice runs to the next `@Resolver(...)`, which is how the classes are separated
 * here; the decorator always precedes its class.
 *
 * Some classes are decorated `@Resolver()` with nothing at all and bind only root fields — five of the
 * platform's own do — so a class is not skipped for naming no type.
 */
function resolverClasses(source) {
	const starts = [...source.matchAll(/@Resolver\(/g)].map((match) => match.index);

	return starts.map((start, index) => {
		const open = source.indexOf('(', start);
		const close = closingParen(source, open);
		const argument = close === -1 ? '' : source.slice(open + 1, close);
		const end = index + 1 < starts.length ? starts[index + 1] : source.length;

		return {
			typeName: resolverType(argument, source.slice(start, end)),
			start,
			end,
			line: source.slice(0, start).split('\n').length
		};
	});
}

/**
 * The parameter list of the method a root-field decorator precedes.
 *
 * Further decorators may sit between the binding and the method — `@Permissions(...)`, `@Idempotent(...)` —
 * so they are stepped over one at a time until the signature is reached. `null` means the method was not
 * found, which the agreement check treats as "states nothing" rather than as agreement.
 */
function methodParameters(source, decoratorOpen) {
	const close = closingParen(source, decoratorOpen);
	if (close === -1) return null;

	let at = close + 1;

	for (;;) {
		const rest = source.slice(at);
		const decorator = /^\s*@[\w.]+/.exec(rest);
		if (!decorator) break;

		const after = at + decorator[0].length;
		if (source[after] === '(') {
			const end = closingParen(source, after);
			if (end === -1) return null;
			at = end + 1;
		} else {
			at = after;
		}
	}

	const signature = /^\s*(?:(?:public|private|protected)\s+)?(?:async\s+)?[\w$]+\s*\(/.exec(source.slice(at));
	if (!signature) return null;

	const open = at + signature[0].length - 1;
	const end = closingParen(source, open);

	return end === -1 ? null : source.slice(open + 1, end);
}

/** Every `.resolver.ts` under a directory, skipping build output and suites. */
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

const RESOLVER_ROOTS = [PLUGINS, join(ROOT, 'packages', 'core', 'src', 'lib')];

const failures = [];
const checked = { fields: 0, roots: 0, resolvers: 0, abstractTypes: 0, rootOnlyTypes: 0, typelessResolvers: 0 };
const boundRootFields = { Query: new Set(), Mutation: new Set(), Subscription: new Set() };

/**
 * The root fields whose *resolver* states `withDeleted`, by the field it binds.
 *
 * The schema half of the same question is read from the snapshot below. The two must agree, and the reason is
 * the shape of the failure rather than tidiness: an argument the resolver accepts and the SDL does not declare
 * is refused by the endpoint as an unknown argument, while an argument the SDL declares and the resolver never
 * reads is *accepted* and silently ignored — a client asking for retired rows is answered with the live ones
 * and has no way to tell. Neither is visible in the source of one side alone.
 */
const withDeletedBound = new Map();

for (const file of RESOLVER_ROOTS.flatMap((root) => resolverFiles(root))) {
	const source = readFileSync(file, 'utf8');
	const path = relative(ROOT, file).split('\\').join('/');

	for (const resolver of resolverClasses(source)) {
		checked.resolvers++;

		const { typeName } = resolver;
		const members = source.slice(resolver.start, resolver.end);

		for (const match of members.matchAll(/@(ResolveField|Query|Mutation|Subscription)\(\s*'([^']+)'/g)) {
			const [kind, field] = [match[1], match[2]];
			const lineNumber = source.slice(0, resolver.start + match.index).split('\n').length;

			if (kind === 'ResolveField') {
				checked.fields++;
				if (typeName === null) {
					failures.push(
						`${path}:${lineNumber} -> \`${field}\` is resolved by a class whose @Resolver() names no type`
					);
					continue;
				}
				const verdict = declares(typeName, field);
				if (verdict === 'missing-field') {
					failures.push(`${path}:${lineNumber} -> \`${field}\` is not declared on \`${typeName}\``);
				} else if (verdict === 'missing-type') {
					failures.push(
						`${path}:${lineNumber} -> \`${field}\` is resolved for \`${typeName}\`, a type the schema does not declare`
					);
				}
				continue;
			}

			checked.roots++;
			const rootType = kind === 'Query' ? 'Query' : kind === 'Mutation' ? 'Mutation' : 'Subscription';
			if (declares(rootType, field) !== 'yes') {
				failures.push(`${path}:${lineNumber} -> @${kind}('${field}') is not declared on \`${rootType}\``);
			}
		}

		// A class that binds only root fields names its type for the reader: `@Resolver('Timer')` is how
		// it is announced, and the fields it contributes live on `Query`/`Mutation`. Nothing hangs off
		// the name, so it is not the schema's business whether such a type exists — only a field resolver
		// makes the name load-bearing.
		if (typeName === null) {
			checked.typelessResolvers++;
		} else if (typeBodies(typeName).length === 0) {
			if (new RegExp(`^union\\s+${typeName}\\b`, 'm').test(schema)) {
				checked.abstractTypes++;
			} else if (!/@ResolveField\(/.test(members)) {
				checked.rootOnlyTypes++;
			} else {
				failures.push(`${path}:${resolver.line} -> @Resolver('${typeName}') names a type the schema does not declare`);
			}
		}

		// A root field is bound in either spelling — `@Query('name')` or `@Query(() => Type, { name: 'name' })` —
		// and this map is what the schema-to-resolver direction reads.
		for (const match of members.matchAll(/@(Query|Mutation|Subscription)\(/g)) {
			const open = resolver.start + match.index + match[0].length - 1;
			const close = closingParen(source, open);
			if (close === -1) continue;

			const args = source.slice(open + 1, close);
			const direct = /^\s*'([^']+)'/.exec(args);
			const named = /\bname:\s*'([^']+)'/.exec(args);
			const field = direct ? direct[1] : named ? named[1] : null;

			if (field) {
				boundRootFields[match[1]].add(field);

				// The decorator's own `(` is the one the match ends on, which `methodParameters` steps past.
				const parameters = methodParameters(source, resolver.start + match.index + match[0].length - 1);

				if (parameters !== null && /['"]withDeleted['"]|\bwithDeleted\b/.test(parameters)) {
					withDeletedBound.set(`${match[1]}.${field}`, `${path}:${source.slice(0, resolver.start + match.index).split('\n').length}`);
				}
			}
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

/**
 * The other direction: a root field the schema declares and no resolver implements.
 *
 * The count is recorded here rather than fixed: each entry needs a service method that does not exist
 * yet, which is a design decision, and a gate that listed them silently would let a new one appear
 * unnoticed.
 */
const UNBOUND = new Map([
	['Query.cartByToken', 'the cart service has no token lookup yet'],
	['Mutation.addCollectionVariants', 'the variant service replaces a whole membership set; an add is not defined'],
	['Mutation.removeCollectionVariants', 'as above, for removal'],
	['Subscription.events', 'the generic event stream a tenant subscribes to'],
	['Subscription.paymentAuthorized', 'payment lifecycle streams'],
	['Subscription.paymentCanceled', 'payment lifecycle streams'],
	['Subscription.paymentCaptured', 'payment lifecycle streams'],
	['Subscription.paymentFailed', 'payment lifecycle streams'],
	['Subscription.paymentRefunded', 'payment lifecycle streams'],
	['Subscription.refundCreated', 'payment lifecycle streams']
]);

const declaredRoots = ['Query', 'Mutation', 'Subscription'].flatMap((type) =>
	[...rootFields(type)].map((field) => `${type}.${field}`)
);
const boundRoots = new Set(
	Object.entries(boundRootFields).flatMap(([type, fields]) => [...fields].map((field) => `${type}.${field}`))
);
const newlyUnbound = declaredRoots.filter((field) => !boundRoots.has(field) && !UNBOUND.has(field));
const recorded = declaredRoots.filter((field) => UNBOUND.has(field));
// An entry whose field now has a resolver is an entry describing a surface that has moved on, and leaving it
// in place quietly overstates how much of the schema is unimplemented — `consumeStockReservation` and
// `updateStockTransfer` were both recorded as unbound for a wave after they had been bound.
const boundButRecorded = [...UNBOUND.keys()].filter((field) => boundRoots.has(field));

if (newlyUnbound.length > 0) {
	console.error('FAILED — root fields the schema declares and no resolver implements:');
	for (const field of newlyUnbound) console.error(`  ${field}`);
	console.error('');
	console.error('Either bind the field to a resolver or record it in `UNBOUND` with the reason it cannot be.');
	process.exit(1);
}

if (boundButRecorded.length > 0) {
	console.error('FAILED — the baseline describes a surface that has moved on:');
	for (const field of boundButRecorded) {
		console.error(`  ${field} has a resolver now — take it out of UNBOUND (${UNBOUND.get(field)})`);
	}
	console.error('');
	console.error('Remove each entry, so the count of what is still unbound stays true.');
	process.exit(1);
}

/**
 * The third check: the schema and the resolvers must agree on `withDeleted`, in both directions.
 *
 * The snapshot is regenerated from the resolvers, so a disagreement cannot survive a rebuild — but it is
 * exactly the disagreement a *partial* edit produces, and the two halves live in different files. Recorded
 * connection by connection, this is what makes "the field offers the soft-delete visibility its REST route
 * offers" a fact about the endpoint rather than about a list in a gate.
 */
const declaredWithDeleted = new Map();

for (const [name, text] of declaredFieldTexts('Query')) {
	if (/withDeleted/.test(text)) declaredWithDeleted.set(`Query.${name}`, text);
}

// The count is what proves the argument reader above saw the fields at all: if its formatting assumption broke,
// this would be zero and every comparison below would pass by finding nothing to compare.
const queryFieldCount = rootFields('Query').size;
const queryTextCount = declaredFieldTexts('Query').size;

if (queryTextCount !== queryFieldCount) {
	console.error(
		`FAILED — the root-field argument reader saw ${queryTextCount} of Query's ${queryFieldCount} field(s), ` +
			'so it cannot answer whether they agree with their resolvers.'
	);
	console.error('The snapshot’s field indentation is what it reads; fix the reader rather than this count.');
	process.exit(1);
}

const declaredButIgnored = [...declaredWithDeleted.keys()].filter((field) => !withDeletedBound.has(field));
const boundButUndeclared = [...withDeletedBound.keys()].filter((field) => !declaredWithDeleted.has(field));

if (declaredButIgnored.length > 0) {
	console.error('FAILED — the schema offers `withDeleted` on fields whose resolver never reads it:');
	for (const field of declaredButIgnored) console.error(`  ${field} (resolver: ${withDeletedBound.get(field) ?? 'none'})`);
	console.error('');
	console.error('Such a field accepts the argument and answers the live rows anyway, so a client cannot tell.');
	process.exit(1);
}

if (boundButUndeclared.length > 0) {
	console.error('FAILED — resolvers read `withDeleted` on fields the schema does not declare it for:');
	for (const field of boundButUndeclared) console.error(`  ${field} (${withDeletedBound.get(field)})`);
	console.error('');
	console.error('Every such request is refused as an unknown argument, so the resolver is unreachable.');
	process.exit(1);
}

console.log(
	`PASSED — ${checked.fields} resolved field(s) and ${checked.roots} root field(s) across ` +
		`${checked.resolvers} resolver(s) all exist on the type that resolves them` +
		(checked.abstractTypes > 0 ? ` (${checked.abstractTypes} abstract type(s) skipped)` : '') +
		(checked.rootOnlyTypes > 0 ? ` (${checked.rootOnlyTypes} root-only resolver(s) name no schema type)` : '') +
		(checked.typelessResolvers > 0 ? ` (${checked.typelessResolvers} typeless resolver(s) bind root fields)` : '') +
		`; ${declaredRoots.length - recorded.length} of ${declaredRoots.length} declared root field(s) are ` +
		`bound, and ${recorded.length} are recorded as unbound with their reason; ` +
		`${declaredWithDeleted.size} field(s) offer \`withDeleted\` and every one of them reads it.`
);
