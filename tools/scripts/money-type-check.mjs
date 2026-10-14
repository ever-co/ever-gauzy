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
import { readFileSync, readdirSync } from 'node:fs';
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
const NOT_MONEY = new Set([
	'quantity',
	'quantities',
	'qty',
	'count',
	'counts',
	'number',
	'version',
	'percent',
	'percentage',
	'weight',
	'length',
	'width',
	'height',
	'volume',
	'latitude',
	'longitude',
	'score',
	'ratio',
	'factor',
	'hours',
	'minutes',
	'seconds',
	'days',
	'latency',
	'duration',
	'severity',
	'progress',
	'priority',
	'rank',
	'index',
	'level',
	'stock',
	'reserved',
	'incoming',
	'available',
	'expected',
	'received',
	'allocated',
	'picked',
	'packed',
	'shipped',
	'rate',
	'rates',
	'taxes'
]);

/**
 * The words of a camelCase or snake_case name, lower-cased: `sellerDiscountAmount` → `seller`, `discount`,
 * `amount`.
 *
 * 🛑 The negative list is matched against these **words**, never as a substring of the whole name. It was a
 * substring regex until 2026-10-14, and `count` is a substring of `discount` and of `account`: every
 * `*Discount*` and `*Account*` field was silently read as "not money", so `SellerTransaction.sellerDiscountAmount`
 * and `SellerSplitReconciliation.platformDiscount` could be declared `Float` and this gate passed. A quantity
 * word excludes a name only when it is one of the name's words.
 */
const words = (name) =>
	name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.toLowerCase()
		.split(/[\s_]+/)
		.filter(Boolean);

/** Whether a member's name says it carries money. */
const isMoneyName = (name) => MONEY.test(name) && !words(name).some((word) => NOT_MONEY.has(word));

/**
 * Members that carry money although their names do not say so, with the reason each is money.
 *
 * The vocabulary decides by name, and a name can be about the band rather than the amount. These are read
 * as money in the composed schema exactly as a money-named field is, and an entry naming a member the
 * schema no longer declares is reported as stale.
 */
const MONEY_BY_MEMBER = new Map([
	[
		'CommissionTierInput.from',
		'a commission band boundary, in major units for an amount basis: `ICommissionTier.from` is a `DecimalString | number` because "a band boundary is money", and the service compares it with `compareDecimalStrings`'
	],
	[
		'CommissionTierInput.to',
		'the exclusive upper boundary of the same band, with the same contract as `from` (`ICommissionTier.to`)'
	]
]);

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

/** Every member the composed schema declares, `Type.member` → its type, for the code-first comparison below. */
const declared = new Map();

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

	declared.set(`${type}.${name}`, fieldType);

	if (!isMoneyName(name) && !MONEY_BY_MEMBER.has(`${type}.${name}`)) continue;

	found.push({ type, name, fieldType });

	if (!/^\[?Float!?\]?!?$/.test(fieldType)) continue;

	if (!EXEMPT.has(`${type}.${name}`)) {
		failures.push(
			`${type}.${name} -> \`${fieldType}\`; money is an exact decimal, so it is \`Decimal\` like every other amount on this surface`
		);
	}
}

/**
 * Code-first declarations of money, which the composed schema does not serve.
 *
 * The rule above reads the SDL because the SDL is what the endpoint serves. A package may also *declare* its
 * types code-first (`@ObjectType`/`@Field(() => Float)`), and in a schema-first plugin those classes are not
 * composed into the schema at all — so they cannot break the wire, and they can drift from it without anything
 * noticing. That is how `marketplace.types.ts` came to declare forty-one members as `Float`, several of them
 * amounts (`grossAmount`, `commissionAmount`, `netAmount`, the balances) while the SDL beside them says
 * `Decimal`.
 *
 * They are counted and named here rather than corrected, because correcting them needs the decision the drift
 * itself raises: either the classes are redundant and should stop restating the schema, or they need a
 * code-first `Decimal` scalar to restate it faithfully — and neither is this gate's call. A *new* one fails, so
 * the pile cannot grow unnoticed, and the count is printed so it can only shrink deliberately.
 *
 * **Raised from 25 to 28 by the marketplace write-parity wave**, which is the deliberate growth this comment
 * asks for rather than a silent one. The three are `SellerPayoutRunResultType.balance`,
 * `SellerPayoutRunResultType.reserveAmount` and `SellerSettlementDifferenceType.platformNet`; their SDL declares
 * each `Decimal!` (`schema-extensions.ts:800`, `:802`, `:853`) while the class beside it says
 * `@Field(() => Float)`, which is the same drift the twenty-five already record. They arrived because those two
 * types are new: the wave added thirteen mutations for REST write routes the GraphQL surface did not answer, and
 * a run result and a settlement difference are where the amounts live. **This is the decision above, taken the
 * other way for three fields**: they should be restated faithfully or the classes should stop restating the
 * schema, and until one of those happens the pile is 28.
 *
 * **Taken to 0 on 2026-10-09 (owner decision: money is `Decimal` everywhere).** The twenty-eight now name the
 * kernel's own `DecimalScalar` (exported from `@gauzy/core`), which is the type their SDL serves, so the classes
 * restate the schema faithfully and any new `Float` amount fails this gate outright.
 *
 * **Zero was not zero (re-measured 2026-10-14, owner decision 7 of 2026-10-13: "Convert to Decimal").** The
 * scanner read the same vocabulary as the SDL rule, and seventeen `Float` members of the same classes slipped
 * past it: three because `count` is a substring of `discount` (`sellerDiscountAmount`,
 * `platformDiscountAmount`, `platformDiscount`), and fourteen because their names do not say money although
 * their schema does — the balance buckets `available`, `pending`, `held`, `negativeCarryForward` and
 * `reserveNextRun` (twice), the split's `splitDelta` and `platformRetained`, a payout run's `payable`, and the
 * rates `commissionRate` (twice), `defaultCommissionRate` and `reservePercent`, every one served as `Decimal`.
 * So a code-first member is now judged **two** ways: by its name, as before, and **against the composed
 * schema's own declaration of the same member** — a class that restates `SellerBalance.available` as `Float`
 * while the schema serves `Decimal!` is drift whatever the member is called. The schema name is the one
 * `@ObjectType('…')` / `@InputType('…')` states, or the class name when it states none.
 *
 * 🛑 **The baseline is zero and can only stay zero**: a raise is refused below, so a new `Float` amount is
 * fixed rather than recorded.
 */
const CODE_FIRST_BASELINE = 0;

/** `@Field(() => Float`, `@Field((type) => Float`, `@Field(type => [Float]` — every spelling of a `Float` field. */
const FLOAT_FIELD = /@Field\(\s*(?:\(\s*\w*\s*\)|\w+)\s*=>\s*\[?\s*Float\b/;

/** `@ObjectType('SellerBalance')` and its kin: the schema type the class below the decorator restates. */
const TYPE_DECORATOR = /@(?:ObjectType|InputType|InterfaceType|ArgsType)\(\s*(?:'(\w+)'|"(\w+)")?/;

/**
 * Judges one code-first `Float` member.
 *
 * @param codeType The class.
 * @param graphqlType The schema type the class restates.
 * @param member The member.
 * @returns Why the member is money, or `null` when it is not.
 */
const codeFirstMoney = (codeType, graphqlType, member) => {
	const served = declared.get(`${graphqlType}.${member}`);
	if (isMoneyName(member)) return `${codeType}.${member} (a money name)`;
	if (served && /\bDecimal\b/.test(served)) {
		return `${codeType}.${member} (the composed schema serves ${graphqlType}.${member} as ${served})`;
	}
	if (MONEY_BY_MEMBER.has(`${graphqlType}.${member}`)) {
		return `${codeType}.${member} (${MONEY_BY_MEMBER.get(`${graphqlType}.${member}`)})`;
	}
	return null;
};

const codeFirst = [];
let codeType = null;
let graphqlType = null;

for (const root of ['packages/plugins', 'packages/core/src']) {
	const walk = (current) => {
		let entries;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch (error) {
			return;
		}

		for (const entry of entries) {
			const child = join(current, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== 'node_modules' && entry.name !== 'dist') walk(child);
				continue;
			}
			if (!entry.name.endsWith('.ts') || entry.name.includes('.spec.')) continue;

			let pendingFloat = false;
			let namedType = null;

			for (const line of readFileSync(child, 'utf8').split(/\r?\n/)) {
				const typeDecorator = TYPE_DECORATOR.exec(line);
				if (typeDecorator) namedType = typeDecorator[1] ?? typeDecorator[2] ?? null;

				const classDeclaration = /export (?:abstract )?class (\w+)/.exec(line);
				if (classDeclaration) {
					codeType = classDeclaration[1];
					graphqlType = namedType ?? classDeclaration[1];
					namedType = null;
				}

				// The decorator and the member it decorates are usually on separate lines, so the decorator arms
				// the next member rather than being matched against the same line as it. A member written on the
				// decorator's own line is read from the rest of that line.
				let candidate = line;
				const float = line.search(FLOAT_FIELD);
				if (float >= 0) {
					pendingFloat = true;
					const sameLine = /\)\s*(?:readonly\s+)?(\w+)\??\s*:/.exec(line.slice(float));
					if (!sameLine) continue;
					candidate = `${sameLine[1]}:`;
				}

				const member = /^\s*(?:readonly )?(\w+)\??\s*:/.exec(candidate);
				if (!member) {
					// A comment between the decorator and its member does not disarm it.
					if (line.trim() !== '' && !/^\s*(?:\/\/|\/\*|\*)/.test(line)) pendingFloat = false;
					continue;
				}

				if (pendingFloat && codeType) {
					const money = codeFirstMoney(codeType, graphqlType, member[1]);
					if (money) codeFirst.push(money);
				}

				pendingFloat = false;
			}
		}
	};
	walk(root);
}

if (CODE_FIRST_BASELINE !== 0) {
	console.error('FAILED — the code-first baseline is not zero. Owner decision 7 (2026-10-13) converted every code-first');
	console.error('money member to `Decimal`; a new one is fixed, not recorded. Put CODE_FIRST_BASELINE back to 0.');
	process.exit(1);
}

for (const name of MONEY_BY_MEMBER.keys()) {
	if (!declared.has(name)) {
		stale.push(`${name} is not declared by the composed schema any more — take it out of MONEY_BY_MEMBER`);
	}
}

for (const name of EXEMPT.keys()) {
	if (!found.some((field) => `${field.type}.${field.name}` === name)) {
		stale.push(`${name} is no longer a money-named field — take it out of EXEMPT (${EXEMPT.get(name)})`);
	} else if (!/^\[?Float!?\]?!?$/.test(found.find((field) => `${field.type}.${field.name}` === name).fieldType)) {
		stale.push(`${name} is not a \`Float\` any more — take it out of EXEMPT (${EXEMPT.get(name)})`);
	}
}

if (codeFirst.length > CODE_FIRST_BASELINE) {
	console.error('FAILED — more code-first money is declared as a float than the recorded baseline:');
	for (const name of codeFirst) console.error(`  ${name}`);
	console.error('');
	console.error(`The baseline is ${CODE_FIRST_BASELINE} and ${codeFirst.length} were found. A schema-first plugin's`);
	console.error('code-first classes are not composed into the schema, so they can drift from it unnoticed — add the');
	console.error('new declaration to the schema first, or point it at the SDL\u2019s own \`Decimal\`.');
	process.exit(1);
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
		(EXEMPT.size > 0 ? `, with ${EXEMPT.size} exempted by name with its reason` : '') +
		`. ${codeFirst.length} code-first declaration(s) of money as a \`Float\` are recorded in classes the composed schema does not serve.`
);
