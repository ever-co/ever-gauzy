import {
	PatternRejection,
	RULE_MAX_MATCH_INPUT,
	RULE_MAX_PATTERN_ALTERNATIVES,
	RULE_MAX_PATTERN_AMBIGUITY,
	RULE_MAX_PATTERN_DEPTH,
	RULE_MAX_PATTERN_GROUPS,
	RULE_MAX_PATTERN_LOOPS,
	RULE_MAX_PATTERN_NODES,
	RULE_MAX_PATTERN_PATHS,
	RULE_MAX_PATTERN_REPETITION,
	analyzePattern
} from './rule.pattern-safety';

/**
 * Whether a `MATCHES` pattern can be run without stopping the process.
 *
 * Nothing here races a clock. A catastrophic pattern is shown to be one by *counting*: a small
 * backtracking matcher below walks a pattern in the order a backtracking engine does and counts every
 * step, with a budget it gives up at. A pattern the old screen accepted exhausts that budget on a few
 * dozen characters; a pattern the analysis accepts stays inside a stated bound at the full subject cap.
 * The verdict itself is asserted through the public entry point, with its reason code, because the
 * reason is what an author is told.
 */

/** Analyses a pattern the way the rule engine compiles it: anchored, at most 256 characters. */
const analyze = (pattern: string, caseInsensitive = false) =>
	analyzePattern(pattern, { maxLength: 256, caseInsensitive });

/** @returns The reason a pattern is refused, or undefined when it is accepted. */
const reasonOf = (pattern: string, caseInsensitive = false): PatternRejection | undefined =>
	analyze(pattern, caseInsensitive).reason;

/** The screen the analysis replaced, verbatim, so the suite can show what it let through. */
function previousScreen(pattern: string): boolean {
	if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > 256) {
		return false;
	}

	if (/\\[1-9]/.test(pattern) || /\([^)]*[+*][^)]*\)\s*[+*]/.test(pattern)) {
		return false;
	}

	try {
		new RegExp(`^(?:${pattern})$`);
		return true;
	} catch {
		return false;
	}
}

/** A node of the counting matcher's tree. */
type CountedNode =
	| { kind: 'atom'; matches: (character: string) => boolean }
	| { kind: 'start' }
	| { kind: 'end' }
	| { kind: 'sequence'; items: CountedNode[] }
	| { kind: 'alternation'; branches: CountedNode[] }
	| { kind: 'repeat'; body: CountedNode; min: number; max: number; greedy: boolean }
	| { kind: 'lookahead'; body: CountedNode; negated: boolean };

/**
 * Reads the subset of the syntax the demonstrations use: literals, escapes, classes, `.`, groups,
 * modifier groups, lookaheads, alternation, anchors and every quantifier. Lookbehinds and
 * backreferences are not read.
 *
 * Every single-character atom is handed to the engine itself as a one-character pattern, so what an
 * atom matches is exactly what V8 says it matches — including the Annex B readings, where `\u` without
 * four hex digits is the letter `u` and `\p` is the letter `p`, and inside a modifier group, where the
 * atom is compiled inside the same `(?i:…)` it was written in. Only the structure around the atoms is
 * interpreted here, and that structure is what the cost comes from.
 */
function readCounted(source: string): CountedNode {
	let index = 0;
	const modifiers: string[] = [];

	const atomOf = (text: string): CountedNode => {
		const single = new RegExp(`^(?:${modifiers.reduceRight((inner, flags) => `(?${flags}:${inner})`, text)})$`);

		return { kind: 'atom', matches: (character) => single.test(character) };
	};

	const readAlternation = (): CountedNode => {
		const branches = [readSequence()];

		while (source[index] === '|') {
			index += 1;
			branches.push(readSequence());
		}

		return branches.length === 1 ? branches[0] : { kind: 'alternation', branches };
	};

	const readSequence = (): CountedNode => {
		const items: CountedNode[] = [];

		while (index < source.length && source[index] !== '|' && source[index] !== ')') {
			items.push(readQuantifier(readAtom()));
		}

		return { kind: 'sequence', items };
	};

	const readAtom = (): CountedNode => {
		const character = source[index];
		const start = index;

		if (character === '(') {
			const lookahead = /^\(\?([=!])/.exec(source.slice(index));
			const modifier = /^\(\?([a-z]*-?[a-z]*):/.exec(source.slice(index));

			if (lookahead) {
				index += 3;

				const body = readAlternation();

				index += 1;

				return { kind: 'lookahead', body, negated: lookahead[1] === '!' };
			}

			index += modifier ? modifier[0].length : 1;

			if (modifier && modifier[1] !== '') {
				modifiers.push(modifier[1]);
			}

			const inner = readAlternation();

			if (modifier && modifier[1] !== '') {
				modifiers.pop();
			}

			index += 1;

			return inner;
		}

		if (character === '^' || character === '$') {
			index += 1;
			return { kind: character === '^' ? 'start' : 'end' };
		}

		if (character === '[') {
			index += source[index + 1] === '^' ? 2 : 1;

			while (source[index] !== ']') {
				index += source[index] === '\\' ? 2 : 1;
			}

			index += 1;

			return atomOf(source.slice(start, index));
		}

		if (character === '\\') {
			const escaped = source[index + 1];

			index += 2;

			if (escaped === 'u' && /^[0-9a-fA-F]{4}/.test(source.slice(index))) {
				index += 4;
			} else if (escaped === 'x' && /^[0-9a-fA-F]{2}/.test(source.slice(index))) {
				index += 2;
			} else if (escaped === '0') {
				index += /^[0-7]{0,2}/.exec(source.slice(index))[0].length;
			}

			return atomOf(source.slice(start, index));
		}

		index += 1;

		return atomOf(character === '.' ? '.' : character.replace(/[{}]/, '\\$&'));
	};

	const readQuantifier = (atom: CountedNode): CountedNode => {
		let min: number;
		let max: number;
		const brace = /^\{(\d+)(,(\d*))?\}/.exec(source.slice(index));

		if (source[index] === '*' || source[index] === '+' || source[index] === '?') {
			min = source[index] === '+' ? 1 : 0;
			max = source[index] === '?' ? 1 : Number.POSITIVE_INFINITY;
			index += 1;
		} else if (brace) {
			min = Number(brace[1]);
			max = brace[2] === undefined ? min : brace[3] === '' ? Number.POSITIVE_INFINITY : Number(brace[3]);
			index += brace[0].length;
		} else {
			return atom;
		}

		const greedy = source[index] !== '?';

		if (!greedy) {
			index += 1;
		}

		return { kind: 'repeat', body: atom, min, max, greedy };
	};

	const tree = readAlternation();

	if (index !== source.length) {
		throw new Error(`The counting matcher cannot read ${source}.`);
	}

	return tree;
}

/** Raised when the counting matcher runs out of budget. */
class BudgetExhausted extends Error {}

/**
 * Walks `^(?:pattern)$` against a subject in the order a backtracking engine does — branches left to
 * right, greedy repetitions longest first, an empty iteration past the minimum refused as the
 * specification requires, a lookahead run to its first match and never backtracked into — and counts
 * every node it enters, inside a lookahead as much as outside one.
 *
 * @returns Whether the pattern matched, or null when the budget ran out first, and the steps taken.
 */
function countSteps(pattern: string, subject: string, budget: number): { matched: boolean | null; steps: number } {
	const tree: CountedNode = { kind: 'sequence', items: [{ kind: 'start' }, readCounted(pattern), { kind: 'end' }] };
	let steps = 0;

	const match = (node: CountedNode, position: number, next: (position: number) => boolean): boolean => {
		steps += 1;

		if (steps > budget) {
			throw new BudgetExhausted();
		}

		switch (node.kind) {
			case 'atom':
				return position < subject.length && node.matches(subject[position]) && next(position + 1);
			case 'start':
				return position === 0 && next(position);
			case 'end':
				return position === subject.length && next(position);
			case 'sequence': {
				const from = (item: number, at: number): boolean =>
					item === node.items.length ? next(at) : match(node.items[item], at, (after) => from(item + 1, after));

				return from(0, position);
			}
			case 'alternation':
				return node.branches.some((branch) => match(branch, position, next));
			case 'repeat': {
				const round = (count: number, at: number): boolean => {
					const again = () =>
						count < node.max &&
						match(node.body, at, (after) => (after === at && count >= node.min ? false : round(count + 1, after)));
					const stop = () => count >= node.min && next(at);

					return node.greedy ? again() || stop() : stop() || again();
				};

				return round(0, position);
			}
			case 'lookahead':
				return match(node.body, position, () => true) !== node.negated && next(position);
		}
	};

	try {
		return { matched: match(tree, 0, () => true), steps };
	} catch (error) {
		if (error instanceof BudgetExhausted) {
			return { matched: null, steps };
		}

		throw error;
	}
}

/**
 * The budget a demonstration exhausts. A million steps is a few milliseconds of engine time; what
 * matters is not the number but that a catastrophic pattern runs through it on a subject an eighth of
 * the cap, and that an accepted one does not come near it.
 */
const BUDGET = 1_000_000;

describe('the counting matcher the demonstrations rest on', () => {
	it('reaches the verdict the engine reaches', () => {
		// Control for everything below: a matcher that counted steps but decided matches differently
		// from V8 would be demonstrating something about itself rather than about the patterns.
		const cases: Array<[string, string[]]> = [
			['(a|a)+', ['a', 'aaaa', '', 'aab']],
			['[A-Z]{2}[0-9]{4}', ['AB1234', 'AB123', 'ab1234']],
			['\\d+(?:\\.\\d+)?', ['12', '12.5', '12.', '.5']],
			['(?:\\u{2})+', ['uu', 'uuuu', 'u', 'u{2}']],
			['\\p{1,}x', ['px', 'pppx', 'x']],
			['(?:\\01|b)+', ['\u0001b', 'b', '01']],
			['[\\d-z]+', ['1-z', 'a', '-']],
			['.*?a.*?b', ['ab', 'xaxb', 'ba']],
			['a{2,3}|b{0,}', ['aa', 'aaaa', '', 'bbb']],
			['(?-i:a|a)+', ['aa', 'a!', 'A']],
			['(?i:a|b)+', ['AbA', 'abc', '']],
			['(?=.*a).+', ['ba', 'bb']],
			['(?!ab).+', ['ab', 'ac', 'b']],
			['(?:(?=[^!]{3})[^!])*!', ['aaa!', 'aaaa!', '!']]
		];

		for (const [pattern, subjects] of cases) {
			for (const subject of subjects) {
				expect({ pattern, subject, matched: countSteps(pattern, subject, BUDGET).matched }).toEqual({
					pattern,
					subject,
					matched: new RegExp(`^(?:${pattern})$`).test(subject)
				});
			}
		}
	});
});

describe('what the screen this replaced let through', () => {
	// Each of these compiles, passed the old screen, and runs a backtracking engine out of a million
	// steps on a subject of a few dozen characters.
	const cases: Array<[string, string, PatternRejection]> = [
		['(a|a)+', `${'a'.repeat(32)}!`, PatternRejection.AMBIGUOUS_ALTERNATION],
		['(\\d|\\w)+', `${'1'.repeat(32)}!`, PatternRejection.AMBIGUOUS_ALTERNATION],
		['(?:a|a?)+', `${'a'.repeat(32)}!`, PatternRejection.NULLABLE_REPETITION],
		['((a+))+', `${'a'.repeat(32)}!`, PatternRejection.STAR_HEIGHT],
		['(a+){2,}', `${'a'.repeat(32)}!`, PatternRejection.STAR_HEIGHT],
		['(.*a){12}', `${'a'.repeat(32)}!`, PatternRejection.STAR_HEIGHT],
		['.*.*.*.*x', 'a'.repeat(64), PatternRejection.SLIDING_REPETITION],
		// `(\w+\s?)+$` itself is one the old screen did catch; moving the inner loop behind a second
		// bracket or the outer one under a brace is enough to get it past.
		['((\\w+)\\s?)+$', `${'a'.repeat(32)}!`, PatternRejection.STAR_HEIGHT],
		['(?:\\w+\\s?){2,}$', `${'a'.repeat(32)}!`, PatternRejection.STAR_HEIGHT],
		// A nested optional part: `{25}` of `a?` is a loop over something that can match nothing, and on
		// a subject that *does* match, the engine tries 2^25 ways of choosing which `a?`s stay empty.
		['(?:a?){25}a{25}', 'a'.repeat(25), PatternRejection.NULLABLE_REPETITION]
	];

	it.each(cases)('%s', (pattern, subject, reason) => {
		expect(previousScreen(pattern)).toBe(true);
		expect(countSteps(pattern, subject, BUDGET).matched).toBeNull();
		expect(reasonOf(pattern)).toBe(reason);
	});

	it('is contrasted with a pattern of the same size that is linear', () => {
		// Control: the budget is not simply too small for a subject of that length.
		expect(countSteps('(?:a|b)+', `${'a'.repeat(64)}!`, BUDGET).steps).toBeLessThan(BUDGET / 1000);
		expect(reasonOf('(?:a|b)+')).toBeUndefined();
	});
});

describe('what a shape analysis has to get right beyond star height', () => {
	// Each of these slips past an analysis that reads star height and compares the first characters
	// of alternatives, but reads escapes the way the modern syntax does, tests a separator by
	// containment, looks only inside loops, reads a modifier group as an ordinary one, or counts a
	// lookaround as free because it consumes nothing — and each still exhausts the budget on a subject
	// no longer than the evaluator allows. The case names the construct the analysis has to read
	// correctly to refuse it.
	it.each<[string, string, string, PatternRejection]>([
		[
			'a separator the first repetition cannot contain, but can overlap',
			'[a-c]+[b-d][a-c]+[b-d][a-c]+[b-d][a-c]+[b-d][a-c]+x',
			'b'.repeat(64),
			PatternRejection.SLIDING_REPETITION
		],
		['repetitions hidden one group deeper each', '.*(?:.*(?:.*(?:.*x)))', 'a'.repeat(64), PatternRejection.SLIDING_REPETITION],
		['a `\\u{…}` that is a quantifier without `u`', '(?:\\u{1,})+', `${'u'.repeat(32)}!`, PatternRejection.STAR_HEIGHT],
		['a `\\p{…}` that is a quantifier without `u`', '\\p{1,}\\p{1,}\\p{1,}\\p{1,}x', 'p'.repeat(64), PatternRejection.SLIDING_REPETITION],
		['a legacy octal escape read as two characters', '(?:\\01|\u0001)+', `${'\u0001'.repeat(32)}!`, PatternRejection.AMBIGUOUS_ALTERNATION],
		['a whitespace character `\\s` was modelled without', '(?:\\s|　)+', `${'　'.repeat(32)}!`, PatternRejection.AMBIGUOUS_ALTERNATION],
		['a class escape at the end of a range', '(?:[\\d-z]|-)+', `${'-'.repeat(32)}!`, PatternRejection.AMBIGUOUS_ALTERNATION],
		[
			'overlapping alternatives outside any loop, multiplied through separators',
			`${'(?:a|a)!'.repeat(10)}.*.*x`,
			`${'a!'.repeat(10)}${'a'.repeat(40)}`,
			PatternRejection.AMBIGUOUS_ALTERNATION
		],
		// A modifier group sets flags for its body, and the engine has accepted them since Node 23. Read as
		// an ordinary group, its body begins with a literal `?`, and `?` and `a` do not overlap.
		['a modifier group that sets no flag at all', '(?-i:a|a)+', `${'a'.repeat(32)}!`, PatternRejection.MODIFIER],
		['a modifier group that makes two cased branches one', '(?i:a|A)+', `${'a'.repeat(32)}!`, PatternRejection.MODIFIER],
		// A lookaround consumes nothing, and it is run in full every time it is reached. Read as costing
		// nothing, each of these was accepted and is cubic in the subject.
		[
			'a lookaround inside a group that looks like one character',
			'.*.*(?:(?=.*a).)x',
			'b'.repeat(256),
			PatternRejection.SLIDING_REPETITION
		],
		[
			'a lookaround that makes no choice but reads two hundred characters per repetition',
			'(?:(?=[^!]{200})[^!])*(?:(?=[^!]{200})[^!])*x',
			'a'.repeat(RULE_MAX_MATCH_INPUT),
			PatternRejection.SCANNING_LOOKAROUND
		],
		// `a{250}` is `a` two hundred and fifty times to the matcher, and a counted loop to the engine:
		// read as one step, it was accepted behind a sliding pair and is cubic in the subject.
		['an exact repetition behind a sliding pair', '.*.*a{250}x', 'a'.repeat(RULE_MAX_MATCH_INPUT), PatternRejection.SLIDING_REPETITION]
	])('%s: %s', (_construct, pattern, subject, reason) => {
		expect(previousScreen(pattern)).toBe(true);
		expect(countSteps(pattern, subject, BUDGET).matched).toBeNull();
		expect(reasonOf(pattern)).toBe(reason);
	});
});

describe('what an accepted pattern can still cost', () => {
	// The claim the evaluator's subject cap rests on: whatever the analysis accepts is at worst one
	// sliding pair — quadratic in the subject — times at most RULE_MAX_PATTERN_AMBIGUITY duplicate
	// paths. These are the most expensive shapes that bound allows, run at the full cap. The constant in
	// front is the few steps each attempt spends on the units around the pair — the character that
	// fails, a one-character lookaround — and is a property of these shapes; what the analysis bounds
	// is the degree, and the subject cap is what makes the degree a number.
	const bound = 4 * RULE_MAX_PATTERN_AMBIGUITY * (RULE_MAX_MATCH_INPUT + 1) ** 2;

	it.each<[string, string]>([
		['.*.*x', 'a'.repeat(RULE_MAX_MATCH_INPUT)],
		['(?:a|a)(?:a|a)(?:a|a)(?:a|a)[\\s\\S]*[\\s\\S]*x', 'a'.repeat(RULE_MAX_MATCH_INPUT)],
		['(?:a|a|a|a|a|a|a|a|a|a|a|a|a|a|a|a).*.*x', 'a'.repeat(RULE_MAX_MATCH_INPUT)],
		['[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', `a@${'a.'.repeat(RULE_MAX_MATCH_INPUT / 2 - 1)}`],
		// A lookaround that scans, where nothing slides before it, is run once; one that reads a single
		// character costs what a character does, even between the two halves of a sliding pair.
		['(?=[\\s\\S]*a)(?:a|a)(?:a|a)(?:a|a)(?:a|a)[\\s\\S]*[\\s\\S]*x', 'a'.repeat(RULE_MAX_MATCH_INPUT)],
		['(?:a|a)(?:a|a)(?:a|a)(?:a|a)[\\s\\S]*(?=a)[\\s\\S]*(?!b)x', 'a'.repeat(RULE_MAX_MATCH_INPUT)],
		// An exact repetition behind a single repetition is reached once per place that one can stop:
		// however much it reads, that is one sliding pair's worth.
		['(?:a|a)(?:a|a)(?:a|a)(?:a|a)[\\s\\S]*[^!]{250}x', 'a'.repeat(RULE_MAX_MATCH_INPUT)],
		['(?:a|a)(?:a|a)(?:a|a)(?:a|a)[\\s\\S]*\\w{16}[\\s\\S]*x', 'a'.repeat(RULE_MAX_MATCH_INPUT)]
	])('%s', (pattern, subject) => {
		expect(reasonOf(pattern)).toBeUndefined();

		const { matched, steps } = countSteps(pattern, subject, bound);

		expect(matched).toBe(false);
		expect(steps).toBeLessThan(bound);
	});

	it('lets through no pattern, in a seeded search, whose cost grows faster than a quadratic', () => {
		// Random patterns over a small alphabet of characters, classes, lookaheads, groups and
		// quantifiers. For each one the analysis accepts, the steps on a 48-character subject are compared
		// with the steps on a 24-character one: doubling the subject at most quadruples a quadratic,
		// octuples a cubic, and runs an exponential out of budget. Seeded, so a failure names a
		// reproducible pattern.
		let state = 0x5eed;
		const random = () => {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			return state / 2 ** 32;
		};
		const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
		const atoms = ['a', 'b', '[ab]', '.', 'x', '[^b]', '\\w', '(?:ab)', '(?=a)', '(?!b)', '(?=ab)', '(?=.*b)'];
		const quantifiers = ['', '', '*', '+', '?', '{2}', '{0,3}', '{1,}', '*?'];
		const generate = (depth: number): string =>
			Array.from({ length: 1 + Math.floor(random() * 5) }, () => {
				const atom =
					depth < 3 && random() < 0.35
						? `(?:${Array.from({ length: 1 + Math.floor(random() * 3) }, () => generate(depth + 1)).join('|')})`
						: pick(atoms);

				return atom + pick(quantifiers);
			}).join('');
		const subjects = (length: number) => [
			`${'a'.repeat(length)}!`,
			`${'ab'.repeat(length / 2)}!`,
			`${'b'.repeat(length)}!`,
			`${'aab'.repeat(length / 3)}!`
		];

		let accepted = 0;
		const offenders: string[] = [];

		for (let attempt = 0; attempt < 1000; attempt += 1) {
			const pattern = generate(0);

			if (reasonOf(pattern) !== undefined) {
				continue;
			}

			accepted += 1;

			const small = subjects(24);
			const large = subjects(48);

			small.forEach((subject, index) => {
				const before = countSteps(pattern, subject, BUDGET);
				const after = countSteps(pattern, large[index], BUDGET);

				if (after.matched === null || (after.steps > 20_000 && after.steps / before.steps > 6)) {
					offenders.push(`${pattern} on ${large[index]}`);
				}
			});
		}

		// Control: a search that the analysis refused entirely would find nothing. With the star-height
		// check switched off, this same search finds offenders; with every lookaround counted as costing
		// nothing, it finds `a{1,}[ab]*(?=.*b)`, which is cubic.
		expect(accepted).toBeGreaterThan(150);
		expect(offenders).toEqual([]);
		expect(reasonOf('a{1,}[ab]*(?=.*b)')).toBe(PatternRejection.SLIDING_REPETITION);
	});
});

describe('analyzePattern', () => {
	it('accepts the patterns rules are actually written with', () => {
		// The control for every refusal in this file: an analysis that refused everything would pass
		// all of them.
		for (const pattern of [
			'[A-Z]{2}[0-9]{4}',
			'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
			'\\d+(?:\\.\\d+)?',
			'-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?',
			'[^@]+@[^@]+',
			'[MK][0-9][A-Z] ?[0-9][A-Z][0-9]',
			'[A-Z]{1,2}\\d[A-Z\\d]? ?\\d[A-Z]{2}',
			'\\d{5}(?:-\\d{4})?',
			'\\+?\\d{1,3}[ -]?\\(?\\d{3}\\)?[ -]?\\d{3}[ -]?\\d{4}',
			'(?:[A-Z]{2}-\\d{4},)+',
			'(?:CA|US|MX)-\\d+',
			'90210|90211',
			'SKU-[0-9]{3,6}',
			'.*@example\\.com',
			'(?=.*\\d)[A-Z0-9]+',
			'\\b\\w+\\b'
		]) {
			expect({ pattern, verdict: analyze(pattern) }).toEqual({ pattern, verdict: { safe: true } });
		}
	});

	it('refuses what is empty, too long, or does not compile, and says which', () => {
		expect(reasonOf('')).toBe(PatternRejection.EMPTY);
		expect(reasonOf(undefined as unknown as string)).toBe(PatternRejection.EMPTY);
		expect(reasonOf('a'.repeat(257))).toBe(PatternRejection.TOO_LONG);
		expect(reasonOf('a'.repeat(256))).toBeUndefined();
		expect(reasonOf('(')).toBe(PatternRejection.SYNTAX);
		expect(reasonOf('[a')).toBe(PatternRejection.SYNTAX);
		expect(reasonOf('a{2,1}')).toBe(PatternRejection.SYNTAX);
		expect(analyze('a'.repeat(257)).detail).toContain('257');
	});

	it('refuses a pattern that escapes the anchors the evaluator wraps it in', () => {
		// `a)|(b` compiles once it is wrapped — `^(?:a)|(b)$` — and then matches any subject that starts
		// with `a`, and runs unanchored besides. The previous screen compiled the wrapped form and so
		// accepted it.
		expect(previousScreen('a)|(b')).toBe(true);
		expect(new RegExp('^(?:a)|(b)$').test('a-anything')).toBe(true);
		expect(reasonOf('a)|(b')).toBe(PatternRejection.SYNTAX);
		expect(reasonOf('x)(')).toBe(PatternRejection.SYNTAX);
	});

	it('refuses a backreference, numbered or named, whose cost depends on the input', () => {
		expect(reasonOf('(a)\\1')).toBe(PatternRejection.BACKREFERENCE);
		expect(reasonOf('(?<word>a)\\k<word>')).toBe(PatternRejection.BACKREFERENCE);
		// Control: inside a class a digit escape is an octal character, not a backreference.
		expect(reasonOf('[\\1]')).toBeUndefined();
	});

	it('refuses a modifier group, whatever flags it sets', () => {
		// Each of these compiles on the Node the platform runs, and each changes what the characters
		// inside it match — or, for `(?-i:…)` in a pattern compiled without `i`, nothing at all.
		expect(() => new RegExp('^(?:(?i:a))$')).not.toThrow();

		for (const pattern of ['(?i:a)', '(?-i:a)', '(?s:.)', '(?m:a)', '(?i-s:a)', 'x(?:y(?i:z))']) {
			expect({ pattern, reason: reasonOf(pattern) }).toEqual({ pattern, reason: PatternRejection.MODIFIER });
		}

		// Controls: the groups whose `(?` the analysis does read.
		for (const pattern of ['(?:a)', '(?=a)a', '(?!b)a', '(?<=a)', '(?<!b)a', '(?<name>a)']) {
			expect({ pattern, reason: reasonOf(pattern) }).toEqual({ pattern, reason: undefined });
		}
	});

	it('refuses a choice inside a loop, and accepts an unrolling or a single optional part', () => {
		expect(reasonOf('(a+)+')).toBe(PatternRejection.STAR_HEIGHT);
		expect(reasonOf('(?:ab?)+')).toBe(PatternRejection.STAR_HEIGHT);
		expect(reasonOf('(?:(?:a|b){2})+')).toBe(PatternRejection.STAR_HEIGHT);
		expect(reasonOf('(?:(?=a+)a)+')).toBe(PatternRejection.STAR_HEIGHT);
		// Controls: `{4}` of something that makes no choice is an unrolling, and a `?` goes round at most
		// once, so neither opens a scope.
		expect(reasonOf('(?:[A-Z]{2}-\\d{4},)+')).toBeUndefined();
		expect(reasonOf('\\d+(?:\\.\\d+)?')).toBeUndefined();
		expect(reasonOf('(?:a|b){3}')).toBeUndefined();
	});

	it('refuses a loop over something that can match nothing', () => {
		expect(reasonOf('(?:)+')).toBe(PatternRejection.NULLABLE_REPETITION);
		expect(reasonOf('(?:$)*')).toBe(PatternRejection.NULLABLE_REPETITION);
		expect(reasonOf('(?:a*)*')).toBe(PatternRejection.NULLABLE_REPETITION);
		expect(reasonOf('(?:|a)+')).toBe(PatternRejection.NULLABLE_REPETITION);
	});

	it('refuses overlapping branches inside a loop, and reads the characters a class really admits', () => {
		expect(reasonOf('(?:a|ab)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:.|x)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		// A branch that matches nothing overlaps every other one, even where the loop body as a whole
		// cannot match nothing.
		expect(reasonOf('(?:x(?:|a))+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		// Controls: a class and its complement, `.` and a line terminator, and branches that differ in
		// their first character do not overlap.
		expect(reasonOf('(?:\\w|\\W)+')).toBeUndefined();
		expect(reasonOf('(?:[^@]|@x)+')).toBeUndefined();
		expect(reasonOf('(?:.|\\n)+')).toBeUndefined();
		expect(reasonOf('(?:ab|cb)+')).toBeUndefined();
	});

	it('models every class escape exactly at the characters where its edges are', () => {
		// Exactness matters most for a negated class: it is a complement, and a complement is only a
		// superset of what the engine matches when what it excludes is no wider. Each code unit near
		// an edge of `\s`, `\w`, `\d` or `.` is paired with the class and with its negation; the pair
		// must be refused exactly when the engine says the class admits the character.
		const edges = new Set<number>();

		for (let code = 0; code <= 0x7f; code += 1) {
			edges.add(code);
		}

		for (let code = 0; code <= 0xffff; code += 1) {
			const character = String.fromCharCode(code);

			if (/\s/.test(character) || !/./.test(character)) {
				[code - 1, code, code + 1].filter((near) => near >= 0 && near <= 0xffff).forEach((near) => edges.add(near));
			}
		}

		const hex = (code: number) => code.toString(16).padStart(4, '0');
		const overlaps = (escape: string, code: number) => reasonOf(`(?:${escape}|\\u${hex(code)})+`) !== undefined;
		const mismatches: string[] = [];

		for (const code of edges) {
			const character = String.fromCharCode(code);

			for (const [escape, matcher] of [
				['\\s', /\s/],
				['\\S', /\S/],
				['\\w', /\w/],
				['\\W', /\W/],
				['\\d', /\d/],
				['\\D', /\D/],
				['.', /./]
			] as Array<[string, RegExp]>) {
				if (overlaps(escape, code) !== matcher.test(character)) {
					mismatches.push(`${escape} U+${hex(code)}`);
				}
			}
		}

		expect(edges.size).toBeGreaterThan(128);
		expect(mismatches).toEqual([]);
	});

	it('reads the escapes JavaScript without `u` reads, as it reads them', () => {
		// Each of these is exactly one character to the engine, so it overlaps the literal it names.
		expect(reasonOf('(?:\\x41|A)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:\\u0041|A)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:\\cJ|\\n)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:[\\101]|A)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:[\\b]|\\x08)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		// And each of these is a letter, which a reader of the modern syntax would get wrong.
		expect(reasonOf('(?:\\x4|x)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:\\p|p)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:\\c1|\\\\)+')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		// Controls: the same escapes against a character they do not denote.
		expect(reasonOf('(?:\\x41|B)+')).toBeUndefined();
		expect(reasonOf('(?:\\01|0)+')).toBeUndefined();
		expect(reasonOf('(?:[\\8]|9)+')).toBeUndefined();
	});

	it('allows one sliding pair on a path and refuses a second', () => {
		expect(reasonOf('a*a*b')).toBeUndefined();
		expect(reasonOf('a*a*a*b')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('a?a?a?aaa')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('\\w+\\s?\\w+\\s?\\w+$')).toBe(PatternRejection.SLIDING_REPETITION);
		// A separator the first repetition cannot consume fixes the boundary; one it can does not.
		expect(reasonOf('[a-z]+@[a-z]+@[a-z]+')).toBeUndefined();
		expect(reasonOf('[a-z@]+@[a-z]+@[a-z]+')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('[ab]*c+[ab]*d+[ab]*')).toBeUndefined();
		// A group hides nothing: each alternative is its own path.
		expect(reasonOf('a*(?:b|a*)a*')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('a*(?:b|c)a*')).toBeUndefined();
	});

	it('caps the ways of reaching the same point outside a loop', () => {
		const overlapping = (count: number) => '(?:a|a)'.repeat(count);

		// Four two-way choices are sixteen ways, which is the budget; a fifth is thirty-two.
		expect(RULE_MAX_PATTERN_AMBIGUITY).toBe(16);
		expect(reasonOf(overlapping(4))).toBeUndefined();
		expect(reasonOf(overlapping(5))).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		// An optional part that wraps a repetition is two ways too; one that wraps a single character is
		// a sliding repetition instead, and disjoint alternatives are no choice at all.
		expect(reasonOf('(?:x\\d+)?(?:y\\d+)?(?:z\\d+)?(?:w\\d+)?')).toBeUndefined();
		expect(reasonOf('(?:x\\d+)?(?:y\\d+)?(?:z\\d+)?(?:w\\d+)?(?:v\\d+)?')).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:A|B)(?:C|D)(?:E|F)(?:G|H)(?:I|J)(?:K|L)')).toBeUndefined();
	});

	it('bounds a lookaround by what it does every time it is reached, and reads a lookbehind backwards', () => {
		expect(reasonOf('(?=.*\\d)[A-Z0-9]+')).toBeUndefined();
		expect(reasonOf('.*(?=.*a.*b)x')).toBe(PatternRejection.SLIDING_REPETITION);
		// Forwards, `c` fixes the boundary: `[ab]*` cannot consume it. The engine runs a lookbehind from
		// right to left, where `[abc]*` is matched first and can stop at any `c`.
		expect(reasonOf('(?=x[ab]*c[abc]*)x.*')).toBeUndefined();
		expect(reasonOf('.*(?<=x[ab]*c[abc]*)')).toBe(PatternRejection.SLIDING_REPETITION);
		// A lookaround that makes a choice slides against a repetition before it like any other would.
		expect(reasonOf('.*.*(?=\\d+)')).toBe(PatternRejection.SLIDING_REPETITION);
		// ...and against nothing after it: the engine never backtracks into a lookaround, so the one at
		// the start of this pattern is run once, and the pair after it is the only sliding one.
		expect(reasonOf('(?=.*a).*.*x')).toBeUndefined();
	});

	it('counts a lookaround that reads more than one character wherever it sits', () => {
		// Inside a loop it is run again on every repetition.
		expect(reasonOf('(?:(?=[^!]{200})[^!])*')).toBe(PatternRejection.SCANNING_LOOKAROUND);
		expect(reasonOf('(?:(?!0000)\\d{4},)+')).toBe(PatternRejection.SCANNING_LOOKAROUND);
		// Inside a group, or an optional part, that would otherwise stand on its path as a single step.
		expect(reasonOf('.*.*(?:(?=.*a).)x')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('.*.*(?:(?=[^!]{200}).)x')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('[^b]*[^b]*(?:(?=[^!]*!)b)?x')).toBe(PatternRejection.SLIDING_REPETITION);
		// Nested inside another lookaround, it scans on every visit of the outer one.
		expect(reasonOf('(?=.*(?=.*x))a')).toBe(PatternRejection.SLIDING_REPETITION);
		// Controls: a lookaround that reads one character, even inside a loop, and one that scans where
		// nothing before it slides.
		expect(reasonOf('(?:\\d(?=\\d))+')).toBeUndefined();
		expect(reasonOf('(?:(?=a|b)c)+')).toBeUndefined();
		expect(reasonOf('(?!0000)\\d{4}')).toBeUndefined();
		expect(reasonOf('(?=\\d{5})\\d+-\\d+')).toBeUndefined();
	});

	it('counts an exact repetition by what it reads on each visit, not by how it is spelled', () => {
		// Behind a sliding pair, anything that reads more than one character is a third degree.
		expect(reasonOf('.*.*a{250}x')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('.*.*\\d{2}x')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('.*.*(?:[^!]{50}){5}x')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('.*.*(?:a\\d{4}|b)x')).toBe(PatternRejection.SLIDING_REPETITION);
		expect(reasonOf('[\\s\\S]*\\w{16}[\\s\\S]*\\w{16}x')).toBe(PatternRejection.SLIDING_REPETITION);
		// Controls: behind one repetition, a short one is a constant and a long one is the pair; a
		// boundary it fixes is not a pair at all; and the same characters written out are text.
		expect(reasonOf('.*\\d{3}-\\d{4}')).toBeUndefined();
		expect(reasonOf('.*a{250}x')).toBeUndefined();
		expect(reasonOf('[^@]*@{250}[^@]*[^@]*')).toBeUndefined();
		expect(reasonOf('.*.*aaaa')).toBeUndefined();
		expect(reasonOf('[A-Z]{2}[0-9]{4}')).toBeUndefined();
	});

	it('widens every character to its other case when the caller compiles with `i`', () => {
		expect(reasonOf('(?:a|A)+')).toBeUndefined();
		expect(reasonOf('(?:a|A)+', true)).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:[a-z]|[A-Z])+', true)).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		expect(reasonOf('(?:é|É)+', true)).toBe(PatternRejection.AMBIGUOUS_ALTERNATION);
		// Without `u`, a character outside ASCII never matches one inside it.
		expect(reasonOf('(?:ſ|s)+', true)).toBeUndefined();
		expect(reasonOf('[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]', true)).toBeUndefined();
	});

	it('refuses a pattern past any of the structural caps, naming the cap', () => {
		expect(reasonOf(`a{${RULE_MAX_PATTERN_REPETITION + 1}}`)).toBe(PatternRejection.TOO_COMPLEX);
		expect(reasonOf(`a{${RULE_MAX_PATTERN_REPETITION}}`)).toBeUndefined();
		expect(reasonOf(`(?:${'(?:'.repeat(RULE_MAX_PATTERN_DEPTH)}a${')'.repeat(RULE_MAX_PATTERN_DEPTH)})`)).toBe(
			PatternRejection.TOO_COMPLEX
		);
		expect(reasonOf('(a)'.repeat(RULE_MAX_PATTERN_GROUPS + 1))).toBe(PatternRejection.TOO_COMPLEX);
		expect(reasonOf('(a)'.repeat(RULE_MAX_PATTERN_GROUPS))).toBeUndefined();
		expect(reasonOf('x\\d?'.repeat(RULE_MAX_PATTERN_LOOPS + 1))).toBe(PatternRejection.TOO_COMPLEX);
		expect(reasonOf('x\\d?'.repeat(RULE_MAX_PATTERN_LOOPS))).toBeUndefined();
		expect(reasonOf(Array.from({ length: RULE_MAX_PATTERN_ALTERNATIVES + 1 }, (_unused, index) => `k${index}`).join('|'))).toBe(
			PatternRejection.TOO_COMPLEX
		);
		expect(analyzePattern('a'.repeat(RULE_MAX_PATTERN_NODES + 1), { maxLength: 1000, caseInsensitive: false }).reason).toBe(
			PatternRejection.TOO_COMPLEX
		);
		// Six three-way alternations that each wrap a repetition unfold into 729 paths.
		expect(3 ** 6).toBeGreaterThan(RULE_MAX_PATTERN_PATHS);
		expect(reasonOf('(?:x\\d+|y|z)'.repeat(6))).toBe(PatternRejection.TOO_COMPLEX);
		expect(reasonOf('(?:x\\d+|y|z)'.repeat(5))).toBeUndefined();
		expect(analyze(`a{${RULE_MAX_PATTERN_REPETITION + 1}}`).detail).toContain(String(RULE_MAX_PATTERN_REPETITION));
	});

	it('is deterministic, and never throws whatever it is handed', () => {
		// A small seeded generator, so a failure names a reproducible input rather than a flaky one.
		let state = 20260921;
		const next = () => {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
			return state / 2 ** 32;
		};
		const alphabet = ['a', 'b', '(', ')', '(?:', '|', '*', '+', '?', '{2}', '{1,}', '[a-b]', '[^a]', '\\', '\\d', '.', '^', '$', '(?=', '(?<=', '(?i:', '\\1', '\\u{', '}'];

		for (let attempt = 0; attempt < 800; attempt += 1) {
			const pattern = Array.from({ length: 1 + Math.floor(next() * 12) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('');
			const first = analyze(pattern);

			expect(analyze(pattern)).toEqual(first);

			if (first.safe) {
				expect(() => new RegExp(`^(?:${pattern})$`)).not.toThrow();
			} else {
				expect(Object.values(PatternRejection)).toContain(first.reason);
				expect(first.detail).toEqual(expect.any(String));
			}
		}
	});

	it('states the caps the platform publishes', () => {
		expect(RULE_MAX_MATCH_INPUT).toBe(512);
		expect(RULE_MAX_PATTERN_LOOPS).toBe(16);
		expect(RULE_MAX_PATTERN_GROUPS).toBe(12);
		expect(RULE_MAX_PATTERN_ALTERNATIVES).toBe(24);
		expect(RULE_MAX_PATTERN_NODES).toBe(400);
		expect(RULE_MAX_PATTERN_DEPTH).toBe(10);
		expect(RULE_MAX_PATTERN_REPETITION).toBe(1000);
		expect(RULE_MAX_PATTERN_PATHS).toBe(256);
	});
});
