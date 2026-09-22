#!/usr/bin/env node
/**
 * Gate: money is never a `Float`.
 *
 * The doctrine's money rule is that an amount is an exact decimal — a `numeric(20,6)` column carried as a
 * decimal string — because a binary float cannot represent 0.10 and a total assembled from floats drifts
 * from the sum of its parts. The schema states that as `Decimal`, and the client is entitled to believe it:
 * a field declared `Float` tells every generated client to parse the amount as a double, and the loss
 * happens in the client, silently, after the server did everything right.
 *
 * The name decides whether a field carries money, as it does in the connection gate, and the vocabulary is
 * deliberately both a positive and a negative list: `unitCost` and `varianceValue` are money, while a
 * quantity, a weight, a percentage and a *rate* are not — and the platform spells one of its rates `taxes`,
 * which is why that word is in the negative list rather than left to be re-derived by the next reader.
 *
 * Run from the repository root: `node tools/scripts/money-type-check.mjs`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SDL = join(ROOT, 'packages', 'core', 'src', 'lib', 'graphql', 'schema', 'schema.graphql');

/** The SDL, with descriptions removed: a description's lines are indented like a field's. */
const schema = readFileSync(SDL, 'utf8')
	.replace(/"""(?:[\s\S]*?)"""/g, '')
	.replace(/^[ \t]*"(?:[^"\\]|\\.)*"[ \t]*$/gm, '')
	.replace(/^[ \t]*#.*$/gm, '');

/** The words that make a field's name money. */
const MONEY =
	/(amount|balance|cost|credit|debit|discount|fee|freight|gross|net|paid|payment|payout|price|refund|shipping|subtotal|surcharge|tax|tip|total|value|commission|settlement|withheld)/i;

/**
 * The words that make a money word something else.
 *
 * A quantity, a count and a duration are not amounts. A `rate` is a factor rather than an amount, and the
 * platform spells its per-variant tax *rate* `taxes` — a percentage with no currency — so both are excluded
 * rather than converted, which is what the field's own description says it is.
 */
const NOT_MONEY =
	/(quantity|qty|count|number|version|percent|percentage|weight|length|width|height|volume|latitude|longitude|score|ratio|factor|hours|minutes|seconds|days|latency|duration|severity|progress|priority|rank|index|level|stock|reserved|incoming|available|expected|received|allocated|picked|packed|shipped|rate|taxes)/i;

/**
 * Money-named fields that are still declared `Float`, with the reason each is exempt.
 *
 * Empty, and kept for the same reason the other gates keep an empty list: a field that needs an exemption is
 * named and reviewed here, and a name left in after its conversion is reported rather than tolerated.
 */
const EXEMPT = new Map([]);

const failures = [];
const stale = [];
const found = [];

let type = null;
let braces = 0;
let parens = 0;
let statement = '';

for (const line of schema.split(/\r?\n/)) {
	const declaration = /^(type|input|interface)\s+([A-Za-z_]\w*)/.exec(line);

	if (declaration) {
		type = declaration[2];
		statement = '';
	}

	// A member is read as a whole statement rather than as a line, for the reason the connection gate
	// records at length: a declaration whose arguments span lines has no name on its type line and no type on
	// its name line, so a line-by-line reader never sees it at all. A member sits one brace deep — inside the
	// type or input it belongs to — which is the depth this reads at, and the brace the *declaration* line
	// opens is counted below like any other, or every depth after it is off by one.
	const atMemberDepth = !declaration && braces === 1 && parens === 0;

	if (!declaration && atMemberDepth && line.trim() !== '') {
		statement = line.trim();
	} else if (!declaration && statement !== '' && line.trim() !== '') {
		statement += ` ${line.trim()}`;
	}

	for (const character of line) {
		if (character === '{') braces++;
		else if (character === '}') braces--;
		else if (character === '(') parens++;
		else if (character === ')') parens--;
	}

	if (statement === '' || braces !== 1 || parens !== 0) continue;

	const field = /^([A-Za-z_]\w*)\s*(\(.*\))?\s*:\s*([A-Za-z_[\].!]+)$/.exec(statement);
	statement = '';

	if (!field || !type) continue;

	const [, name, , fieldType] = field;

	if (!MONEY.test(name) || NOT_MONEY.test(name)) continue;

	found.push({ type, name, fieldType });

	if (!/^\[?Float!?\]?!?$/.test(fieldType)) continue;

	if (!EXEMPT.has(`${type}.${name}`)) {
		failures.push(
			`${type}.${name} -> \`${fieldType}\`; money is an exact decimal, so it is \`Decimal\` like every other amount on this surface`
		);
	}
}

for (const name of EXEMPT.keys()) {
	if (!found.some((field) => `${field.type}.${field.name}` === name)) {
		stale.push(`${name} is no longer a money-named field — take it out of EXEMPT (${EXEMPT.get(name)})`);
	} else if (!/^\[?Float!?\]?!?$/.test(found.find((field) => `${field.type}.${field.name}` === name).fieldType)) {
		stale.push(`${name} is not a \`Float\` any more — take it out of EXEMPT (${EXEMPT.get(name)})`);
	}
}

if (!/^scalar Decimal$/m.test(schema)) {
	failures.push('the schema declares no `Decimal` scalar, so the type this rule names does not exist');
}

if (failures.length > 0) {
	console.error('FAILED — money is declared as a float:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('An amount is an exact decimal: a binary float cannot represent 0.10, and a total assembled');
	console.error('from floats drifts from the sum of its parts. Declare it `Decimal`, or name it in EXEMPT with');
	console.error('the reason it is not money.');
	process.exit(1);
}

if (stale.length > 0) {
	console.error('FAILED — the baseline describes a surface that has moved on:');
	for (const entry of stale) console.error(`  ${entry}`);
	console.error('');
	console.error('Remove each entry, so the exemption list keeps describing what is actually exempt.');
	process.exit(1);
}

console.log(
	`PASSED — ${found.length} money-named field(s) read across ${new Set(found.map((field) => field.type)).size} ` +
		`type(s), and none of them is a \`Float\`: every amount on this surface is the \`Decimal\` scalar` +
		(EXEMPT.size > 0 ? `, with ${EXEMPT.size} exempted by name with its reason.` : '.')
);
