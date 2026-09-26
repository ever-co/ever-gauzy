/**
 * Whether a `MATCHES` pattern can be run on the event loop without stopping the process.
 *
 * A rule is data an administrator writes and the evaluator runs against buyer-controlled text on
 * every cart and pricing write. A regular expression that backtracks catastrophically is therefore
 * not a slow rule: it is a remote denial of service against every tenant sharing the pod, authored
 * through an ordinary, permitted write.
 *
 * ## What the previous screen was, and why it was not one
 *
 * The check this file replaces was two regular expressions:
 *
 * ```ts
 * if (/\\[1-9]/.test(pattern) || /\([^)]*[+*][^)]*\)\s*[+*]/.test(pattern)) { return false; }
 * ```
 *
 * The first half is sound — a backreference makes a pattern's cost depend on the input — and it is
 * kept. The second was meant to catch a quantified group whose body is itself quantified, and it only
 * ever saw a `+` or `*` directly inside a *flat* group that is followed by a `+` or `*`. Every one of
 * these compiles, walked past it, and takes exponential or high-polynomial time on a few dozen
 * characters of input that does not match — the suite counts the steps:
 *
 * - `(a|a)+` and `(\d|\w)+` — a loop over two branches that match the same text, with no nested
 *   quantifier anywhere for the heuristic to find;
 * - `(?:a|a?)+` — the inner quantifier is a `?`, which it did not look for;
 * - `((a+))+` — the inner quantifier sits behind a second bracket, which `[^)]*` cannot cross;
 * - `(a+){2,}` and `(.*a){12}` — the outer quantifier is a brace;
 * - `.*.*.*.*x` — no group at all, and a polynomial of degree four in the subject length.
 *
 * ## What this does instead
 *
 * The pattern is parsed into a small tree, and the tree is checked against bounds that each close one
 * way of building a pattern whose number of match attempts grows faster than the subject does.
 *
 * 1. **Star height.** A *loop* is a quantifier the engine may take round a variable number of times
 *    and more than once — `*`, `+`, `{2,5}` — or an exact `{n}` of something that itself chooses,
 *    because `(?:.*a){20}` is twenty nested `.*`s however it is spelled. Inside a loop, any further
 *    choice — another loop, or a `?` — is refused: the two choices multiply. A `?` goes round at most
 *    once, so outside a loop it does not open a scope of its own, and `\d+(?:\.\d+)?` is accepted.
 *    An exact `{n}` of something that makes no choice is an unrolling rather than a loop, which is
 *    what keeps `(?:[A-Z]{2}-\d{4},)+` legal.
 * 2. **Deterministic loop bodies.** Inside a loop, the branches of every alternation are compared by
 *    the characters each can *begin* with; overlapping branches, a branch that can match nothing, and
 *    a loop whose body can match nothing are refused. With (1), what is left is a loop body the engine
 *    can match in at most one way from any position, so the loop's only choice is where to stop.
 * 3. **At most one sliding pair.** Outside loops, the pattern is unfolded into the paths its
 *    alternations and optional parts allow, and on each path the repetitions whose boundary can slide
 *    are counted: `.*a.*a.*a.*b` has neither a nested loop nor an alternation, yet the engine tries
 *    every way of dividing the subject between its four `.*`s. Two may slide against each other,
 *    because that is the shape of half the patterns anybody writes and it is quadratic over a bounded
 *    subject; three may not. A unit that does not slide but *re-reads* the subject on every visit
 *    counts as well, by what it reads times how often it is reached: an exact repetition such as
 *    `a{250}` — a counted loop to the engine, however it looks — and a scanning lookaround, see (5).
 *    Behind a sliding pair either is a third degree (`.*.*a{250}x` is cubic); behind one repetition
 *    it is a second degree only when it reads more than a handful of characters, so `.*\d{3}-\d{4}`
 *    stays legal.
 * 4. **A bounded number of duplicate paths.** Outside a loop, an alternation whose branches overlap,
 *    and an optional part that wraps a repetition or can match nothing, each let the engine reach the
 *    same place more than one way, and those multiply across the whole pattern — through every
 *    separator, since a separator fixes a boundary, not how many ways there were to reach it. Their
 *    product is capped at {@link RULE_MAX_PATTERN_AMBIGUITY}.
 * 5. **Lookarounds.** A lookaround consumes nothing, but it is run again each time the engine reaches
 *    it, so its body may hold no sliding pair of its own. A lookaround *scans* when it makes a choice
 *    or can examine more than one character, and a scanning lookaround is counted wherever it sits: on
 *    its path it re-reads the subject as (3) describes, inside a loop it is refused, and a group or an
 *    exact repetition that holds one is unfolded rather than read as a single step —
 *    `.*.*(?:(?=.*a).)x` is cubic although the group looks like one character. It slides against
 *    nothing *after* it, because the engine never backtracks into a lookaround. A lookaround that
 *    examines one character costs what a character does and is left alone. A lookbehind is analysed
 *    reversed, because the engine matches it from right to left.
 * 6. **A bounded subject.** {@link RULE_MAX_MATCH_INPUT} caps the text a pattern is ever applied to.
 *    This is the bound that does not depend on the analysis being complete: whatever survives (1) to
 *    (5) is at worst polynomial in the subject length, and the subject length is a constant.
 * 7. **A bounded pattern.** Length, node count, loop count, group count, alternative count, nesting
 *    depth, the number of unfolded paths and the repetition counts themselves are all capped, so the
 *    analysis and the match are both bounded by construction rather than by the author's restraint.
 *
 * Every character set below is modelled as a *superset* of what the engine matches — exactly where the
 * code can afford it, widened where it cannot — and every check is written so that a wider set can
 * only refuse more. That, not the precision of the model, is what the verdict rests on.
 *
 * ## What it still cannot catch
 *
 * Stated plainly, because a claim of safety that is not true is worse than a bound that is.
 *
 * - **It is an approximation, not a decision procedure.** Branches are compared by their first
 *   character, so `(?:ab|ac)+` is refused although it is deterministic; the checks err towards refusing.
 *   (1) and (2) leave a loop nothing to choose but where to stop, which rules out exponential
 *   backtracking inside one; the argument for (3) and (4) — that what survives is at worst quadratic,
 *   times the duplicate-path cap — rests on the shapes the suite counts and on a seeded search over
 *   random patterns, not on a proof over every pattern.
 * - **Polynomial cost inside the caps.** One sliding pair is quadratic in the subject, multiplied by at
 *   most {@link RULE_MAX_PATTERN_AMBIGUITY} duplicate paths, and by the few characters each attempt
 *   reads after the pair before it fails. Bound (6) is what makes that acceptable: over a
 *   512-character subject it is millions of steps at the very worst, not billions. A run of literal
 *   characters after the pair is part of that constant rather than a degree of its own, because the
 *   pattern's length bounds it.
 * - **Engine-specific behaviour.** The analysis reasons about the pattern, not about V8's Irregexp. A
 *   future engine optimisation or regression changes the constant, not the shape, but the constant is
 *   what an operator feels — and a pattern's first run is interpreted before V8 compiles it, at many
 *   times the cost of every later one.
 * - **Flags it was not told about.** The analysis models the anchored form `^(?:pattern)$` compiled
 *   with no flags, or with `i` when the caller says so. `m`, `s`, `u` and `v` change the syntax or the
 *   character sets it models, and a caller compiling with them is outside what this answers. The
 *   same flags set *inside* the pattern — the modifier groups `(?i:…)`, `(?s:…)`, `(?-i:…)` that the
 *   engine accepts from Node 23 — are refused rather than modelled: read as an ordinary group, the
 *   harmless-looking `(?-i:a|a)+` is `(?:a|a)+`.
 * - **Aggregate cost.** One pattern is bounded; a rule set is bounded separately, by
 *   `RULE_MAX_GROUPS` × `RULE_MAX_RULES_PER_GROUP`. The two bounds multiply, and nothing here limits
 *   how many rule sets one request evaluates — that is the caller's budget to keep.
 * - **Constructs deliberately refused rather than analysed.** Backreferences and named
 *   backreferences are refused outright, because their cost is input-dependent in a way no static
 *   shape check can bound; modifier groups are refused because they change what every character
 *   inside them means. A pattern that needs one has to be expressed another way.
 */

/** How long a subject a `MATCHES` pattern is ever applied to. */
export const RULE_MAX_MATCH_INPUT = 512;

/** The most variable-repetition quantifiers — loops and `?` alike — one pattern may declare. */
export const RULE_MAX_PATTERN_LOOPS = 16;

/** The most groups — capturing, non-capturing or lookaround — one pattern may declare. */
export const RULE_MAX_PATTERN_GROUPS = 12;

/** The most alternation branches one pattern may declare, counted across every alternation in it. */
export const RULE_MAX_PATTERN_ALTERNATIVES = 24;

/** The most nodes one pattern's tree may hold. */
export const RULE_MAX_PATTERN_NODES = 400;

/** How deeply groups may nest. */
export const RULE_MAX_PATTERN_DEPTH = 10;

/** The largest repetition count a `{n,m}` may state. */
export const RULE_MAX_PATTERN_REPETITION = 1000;

/** The most paths the pattern may unfold into when its alternations and optional parts are expanded. */
export const RULE_MAX_PATTERN_PATHS = 256;

/**
 * The most ways, outside a loop, the engine may have of reaching the same point of one pattern.
 *
 * The product of the branch counts of every overlapping alternation, and of two for every optional
 * part that wraps a repetition or can match nothing. See the file comment, bound (4).
 */
export const RULE_MAX_PATTERN_AMBIGUITY = 16;

/**
 * How many repetitions on one path may share a sliding boundary.
 *
 * Each one adds a degree to the polynomial the engine walks; see the file comment, bound (3), for why
 * two is work and three is not.
 */
const MAX_SLIDING_REPETITIONS = 2;

/**
 * The most characters a unit that does not slide may read on each visit and still cost a constant.
 *
 * An exact repetition and a lookaround both re-read the subject every time the engine reaches them. Up
 * to this width that is a constant factor on whatever reaches them; past it, it is a degree of its own:
 * `.*a{250}` reads two hundred and fifty characters at each of the positions `.*` can stop at. See
 * {@link countSlidingRepetitions}.
 */
const MAX_CONSTANT_SCAN_WIDTH = 16;

/** The highest UTF-16 code unit. A pattern compiled without `u` matches code units, not code points. */
const MAX_CODE_UNIT = 0xffff;

/**
 * Why a pattern was refused.
 *
 * The reason is reported rather than only the verdict, because "your pattern can backtrack" and
 * "your pattern is too long" are different mistakes and an author can only fix the one they are
 * told about.
 */
export enum PatternRejection {
	/** The pattern is empty. */
	EMPTY = 'EMPTY',
	/** The pattern is longer than the platform accepts. */
	TOO_LONG = 'TOO_LONG',
	/** JavaScript cannot compile the pattern. */
	SYNTAX = 'SYNTAX',
	/** The pattern uses a backreference, whose cost depends on the input. */
	BACKREFERENCE = 'BACKREFERENCE',
	/** The pattern uses a modifier group, such as `(?i:…)`, that changes what the characters inside it match. */
	MODIFIER = 'MODIFIER',
	/** A choice sits inside a loop's scope. */
	STAR_HEIGHT = 'STAR_HEIGHT',
	/** A lookaround that examines more than one character sits inside a loop, which runs it again on every repetition. */
	SCANNING_LOOKAROUND = 'SCANNING_LOOKAROUND',
	/** Branches of an alternation overlap inside a loop, or duplicate paths outside one exceed the cap. */
	AMBIGUOUS_ALTERNATION = 'AMBIGUOUS_ALTERNATION',
	/** A loop repeats something that can match nothing, so every position is a choice point. */
	NULLABLE_REPETITION = 'NULLABLE_REPETITION',
	/** More repetitions than the cap can divide one stretch of the subject between them. */
	SLIDING_REPETITION = 'SLIDING_REPETITION',
	/** The pattern exceeds one of the structural caps. */
	TOO_COMPLEX = 'TOO_COMPLEX'
}

/** What the analysis decided about one pattern. */
export interface IPatternVerdict {
	/** True when the pattern may be compiled and run. */
	safe: boolean;

	/** Why it was refused, when it was. */
	reason?: PatternRejection;

	/** A sentence naming the offending construct, for the author. */
	detail?: string;
}

/** How the caller compiles the pattern it asks about. */
export interface IPatternAnalysisOptions {
	/** The longest pattern accepted. */
	maxLength: number;

	/**
	 * Whether the caller compiles with the `i` flag. Case-insensitive matching widens what every
	 * literal and class admits, so two branches that differ only in case overlap under it.
	 */
	caseInsensitive: boolean;
}

/**
 * A set of UTF-16 code units.
 *
 * Used to ask whether two parts of a pattern can consume the same character, and nothing else. A
 * negated class is modelled as a complement rather than widened to "any character", and that is
 * load-bearing rather than tidy: `[^@]+@[^@]+` is a perfectly safe pattern whose boundary cannot slide
 * precisely *because* `[^@]` cannot match the `@` between the two repetitions, and a model that read
 * `[^@]` as "any character" would refuse it.
 */
interface ICharSet {
	/** True when the set is everything *except* {@link ranges}. */
	complement: boolean;

	/** Sorted, disjoint, inclusive code-unit ranges: the set, or — for a complement — what it excludes. */
	ranges: ReadonlyArray<readonly [number, number]>;
}

/** A node of the parsed pattern. */
type PatternNode =
	| { kind: 'char'; set: ICharSet }
	| { kind: 'assertion' }
	| { kind: 'group'; alternatives: PatternNode[][]; lookaround: boolean }
	| { kind: 'repeat'; body: PatternNode; min: number; max: number };

/** One element of an unfolded path, as the sliding check sees it. */
interface IPathUnit {
	/** Whether the unit consumes a variable amount of text, so that its boundary can slide. */
	sliding: boolean;

	/** Whether the unit must consume at least one character wherever the path matches. */
	mandatory: boolean;

	/** The characters the unit can begin with. */
	first: ICharSet;

	/** Every character the unit can consume. */
	consumes: ICharSet;

	/**
	 * How many characters the unit reads every time it is reached, when it reads more than one without
	 * sliding: a scanning lookaround (infinity when it makes a choice), or an exact repetition such as
	 * `a{250}`, which the engine runs as a counted loop. See {@link countSlidingRepetitions} for when
	 * such a unit counts as a sliding repetition of its own.
	 */
	scan?: number;
}

/** Raised by the analysis; carried out through {@link analyzePattern} as a verdict. */
class PatternRefusal extends Error {
	constructor(readonly reason: PatternRejection, readonly detail: string) {
		super(detail);
	}
}

/** What the parser counted while it read the pattern. */
interface IParseCounters {
	nodes: number;
	loops: number;
	groups: number;
	alternatives: number;
	depth: number;
}

/**
 * Decides whether a pattern may be compiled and run.
 *
 * Deterministic and self-contained: the same pattern and options always produce the same verdict, and
 * nothing outside this file is consulted except the engine's own parser, which is asked only whether
 * the pattern compiles — compiling never runs it.
 *
 * @param pattern The pattern as the author wrote it, without the anchors the evaluator adds.
 * @param options The longest pattern accepted, and whether the caller compiles with `i`.
 * @returns The verdict, and the reason when it refuses. It never throws: an analysis that fails for a
 * reason of its own refuses the pattern rather than letting it through.
 */
export function analyzePattern(pattern: string, options: IPatternAnalysisOptions): IPatternVerdict {
	if (typeof pattern !== 'string' || pattern.length === 0) {
		return { safe: false, reason: PatternRejection.EMPTY, detail: 'A MATCHES pattern cannot be empty.' };
	}

	if (pattern.length > options.maxLength) {
		return {
			safe: false,
			reason: PatternRejection.TOO_LONG,
			detail: `A MATCHES pattern is at most ${options.maxLength} characters; this one is ${pattern.length}.`
		};
	}

	try {
		// The engine that will run the pattern decides its syntax first, so that the reader below only
		// ever sees patterns JavaScript accepts and a typing mistake is reported as one rather than as
		// whatever the analysis happened to trip over.
		new RegExp(`^(?:${pattern})$`, options.caseInsensitive ? 'i' : '');
	} catch {
		return {
			safe: false,
			reason: PatternRejection.SYNTAX,
			detail: 'The MATCHES pattern is not a regular expression JavaScript can compile.'
		};
	}

	try {
		// The reader also refuses what the compile above cannot: `a)|(b` compiles once it is wrapped as
		// `^(?:a)|(b)$`, and that is a pattern that has escaped the anchors the evaluator puts round it.
		const parsed = parsePattern(pattern, options.caseInsensitive);

		assertWithinCaps(parsed.counters);

		// The pattern's own alternatives are a top-level alternation that is not inside a loop, which
		// is exactly what the anchored form the evaluator compiles makes them.
		const root: PatternNode = { kind: 'group', alternatives: parsed.alternatives, lookaround: false };

		assertLoopsDeterministic(root, false);
		assertAmbiguityWithinBudget(root);
		assertLookaroundsLinear(root);
		assertPathsSlideAtMostOnce(parsed.alternatives, MAX_SLIDING_REPETITIONS);
	} catch (error) {
		if (error instanceof PatternRefusal) {
			return { safe: false, reason: error.reason, detail: error.detail };
		}

		// Fail closed: an analysis that could not finish has not shown the pattern is safe.
		return {
			safe: false,
			reason: PatternRejection.TOO_COMPLEX,
			detail: 'The MATCHES pattern could not be analysed.'
		};
	}

	return { safe: true };
}

/**
 * @param counters What the parser counted.
 * @throws PatternRefusal when a cap was exceeded.
 */
function assertWithinCaps(counters: IParseCounters): void {
	const exceeded: Array<[string, number, number]> = [
		['nodes', counters.nodes, RULE_MAX_PATTERN_NODES],
		['repeating quantifiers', counters.loops, RULE_MAX_PATTERN_LOOPS],
		['groups', counters.groups, RULE_MAX_PATTERN_GROUPS],
		['alternation branches', counters.alternatives, RULE_MAX_PATTERN_ALTERNATIVES],
		['nesting depth', counters.depth, RULE_MAX_PATTERN_DEPTH]
	];

	for (const [what, value, cap] of exceeded) {
		if (value > cap) {
			throw new PatternRefusal(
				PatternRejection.TOO_COMPLEX,
				`A MATCHES pattern declares at most ${cap} ${what}; this one declares ${value}.`
			);
		}
	}
}

/**
 * Reads a pattern into a tree.
 *
 * A recursive-descent reader over JavaScript's syntax *without* the `u` flag, Annex B included,
 * because that is how the evaluator compiles. It is written here rather than taken from a dependency
 * because what it has to be is *conservative*: every construct has to become at least everything the
 * engine would let it match, so that the checks above it refuse rather than admit. A general parser
 * optimises for describing a pattern exactly, which is a different goal and fails in the opposite
 * direction.
 *
 * The Annex B corners matter, because each of them is a way to hide a quantifier or a character from
 * a reader that assumes the modern syntax: without `u`, `\u{2}` is `u` repeated twice and `\p{1,}` is
 * `p+`, `\01` is one character and not two, `[\d-z]` is `\d`, `-` and `z` rather than a range, and
 * `\c` followed by a non-letter is a literal backslash.
 *
 * @param pattern The pattern text, already known to compile.
 * @param caseInsensitive Whether the caller compiles with `i`.
 * @returns The top-level alternatives and what was counted while reading them.
 * @throws PatternRefusal when the pattern uses a construct the platform refuses or exceeds a cap.
 */
function parsePattern(
	pattern: string,
	caseInsensitive: boolean
): { alternatives: PatternNode[][]; counters: IParseCounters } {
	const counters: IParseCounters = { nodes: 0, loops: 0, groups: 0, alternatives: 0, depth: 0 };
	let index = 0;

	/**
	 * @returns The character at the cursor, or the empty string at the end.
	 */
	const peek = (): string => pattern[index] ?? '';

	/**
	 * @param set A set a literal, an escape or a class admits.
	 * @returns The set widened to what `i` would let it match, when the caller compiles with `i`.
	 */
	const folded = (set: ICharSet): ICharSet => (caseInsensitive ? foldCase(set) : set);

	/**
	 * Reads one alternation — a sequence, then `|`, then another — until the pattern or the enclosing
	 * group ends.
	 *
	 * @param depth How many groups enclose this alternation.
	 * @returns The branches.
	 */
	const readAlternation = (depth: number): PatternNode[][] => {
		counters.depth = Math.max(counters.depth, depth);

		if (depth > RULE_MAX_PATTERN_DEPTH) {
			throw new PatternRefusal(
				PatternRejection.TOO_COMPLEX,
				`A MATCHES pattern nests at most ${RULE_MAX_PATTERN_DEPTH} groups deep.`
			);
		}

		const alternatives: PatternNode[][] = [readSequence(depth)];

		while (peek() === '|') {
			index += 1;
			counters.alternatives += 1;
			alternatives.push(readSequence(depth));
		}

		if (alternatives.length > 1) {
			// The first branch is counted here so that a two-branch alternation counts as two.
			counters.alternatives += 1;
		}

		return alternatives;
	};

	/**
	 * Reads one branch: atoms with their quantifiers, until `|`, `)` or the end.
	 *
	 * @param depth How many groups enclose this sequence.
	 * @returns The nodes of the branch.
	 */
	const readSequence = (depth: number): PatternNode[] => {
		const nodes: PatternNode[] = [];

		while (index < pattern.length && peek() !== '|' && peek() !== ')') {
			const atom = readAtom(depth);
			nodes.push(readQuantifier(atom));
		}

		return nodes;
	};

	/**
	 * Reads one atom: a group, a class, an escape, an anchor or a literal.
	 *
	 * @param depth How many groups enclose this atom.
	 * @returns The node.
	 */
	const readAtom = (depth: number): PatternNode => {
		counters.nodes += 1;

		if (counters.nodes > RULE_MAX_PATTERN_NODES) {
			throw new PatternRefusal(
				PatternRejection.TOO_COMPLEX,
				`A MATCHES pattern holds at most ${RULE_MAX_PATTERN_NODES} elements.`
			);
		}

		const character = pattern[index];

		if (character === '(') {
			index += 1;
			counters.groups += 1;

			let lookaround = false;
			let lookbehind = false;

			if (pattern.startsWith('?:', index)) {
				index += 2;
			} else if (pattern.startsWith('?=', index) || pattern.startsWith('?!', index)) {
				index += 2;
				lookaround = true;
			} else if (pattern.startsWith('?<=', index) || pattern.startsWith('?<!', index)) {
				index += 3;
				lookaround = true;
				lookbehind = true;
			} else if (pattern.startsWith('?<', index)) {
				// A named capture group. The name is read and discarded; what matters is the body.
				index = pattern.indexOf('>', index) + 1;
			} else if (peek() === '?') {
				// Every other `(?` the engine compiles is a modifier group — `(?i:…)`, `(?s:…)`, `(?-i:…)`,
				// accepted since V8 12.5 and Node 23. Each changes what the characters inside it match, and
				// read as an ordinary group its body starts with a literal `?`: `(?-i:a|a)+` would compare
				// `?` with `a`, find them disjoint, and admit `(?:a|a)+`.
				throw new PatternRefusal(
					PatternRejection.MODIFIER,
					'A MATCHES pattern cannot use a modifier group such as (?i:…) or (?s:…); write the characters it should match out instead.'
				);
			}

			const alternatives = readAlternation(depth + 1);

			if (peek() !== ')') {
				throw new PatternRefusal(PatternRejection.SYNTAX, 'The MATCHES pattern has a group that is never closed.');
			}

			index += 1;

			// The engine matches a lookbehind from right to left, so it is analysed the way it runs:
			// reversed. The checks read first characters, and backwards the first character is the last.
			return { kind: 'group', alternatives: lookbehind ? alternatives.map(reverseSequence) : alternatives, lookaround };
		}

		if (character === '[') {
			return { kind: 'char', set: readCharacterClass() };
		}

		if (character === '^' || character === '$') {
			index += 1;
			return { kind: 'assertion' };
		}

		if (character === '.') {
			index += 1;
			// Every code unit but the four line terminators, which `.` does not match without `s`.
			return { kind: 'char', set: complementOf(fromRanges([[0x0a, 0x0a], [0x0d, 0x0d], [0x2028, 0x2029]])) };
		}

		if (character === '\\') {
			const set = readEscape(false);

			return set === null ? { kind: 'assertion' } : { kind: 'char', set: folded(set) };
		}

		// A literal — including the `{`, `}` and `]` that JavaScript without `u` reads as themselves.
		index += 1;

		return { kind: 'char', set: folded(singleton(character.charCodeAt(0))) };
	};

	/**
	 * Reads one escape sequence and advances past exactly what the engine reads as part of it.
	 *
	 * Consuming too much is as dangerous as consuming too little: `\u{1,}` read as one code-point
	 * escape swallows the `{1,}` that JavaScript without `u` applies as a quantifier to a literal `u`,
	 * and the loop it states disappears from the tree.
	 *
	 * @param inClass Whether the escape sits inside a `[...]`, where `b` is a backspace rather than a
	 * word boundary, where a digit is an octal escape rather than a backreference, and where an anchor
	 * cannot appear.
	 * @returns The code units the escape admits, or null when it is a zero-width assertion.
	 * @throws PatternRefusal for a backreference.
	 */
	const readEscape = (inClass: boolean): ICharSet | null => {
		index += 1;

		const escaped = pattern[index] ?? '';

		if (!inClass && (/[1-9]/.test(escaped) || escaped === 'k')) {
			// A backreference makes the cost of a match depend on what the input happened to capture,
			// which is the one shape no structural analysis can bound. `\k` is refused whether or not
			// the pattern names a group, because the reading depends on that and a refusal does not.
			throw new PatternRefusal(
				PatternRejection.BACKREFERENCE,
				'A MATCHES pattern cannot use a backreference; its cost depends on the input it is matched against.'
			);
		}

		if (!inClass && (escaped === 'b' || escaped === 'B')) {
			index += 1;
			return null;
		}

		if (escaped === 'c') {
			const control = pattern[index + 1] ?? '';

			if (/[A-Za-z]/.test(control) || (inClass && /[0-9_]/.test(control))) {
				index += 2;
				return singleton(control.charCodeAt(0) % 32);
			}

			// `\c` that does not introduce a control letter is a literal backslash, and the `c` is read
			// again as whatever it is on its own. The cursor is left on it for exactly that.
			return singleton(0x5c);
		}

		if (/[0-7]/.test(escaped) && (inClass || escaped === '0')) {
			// A legacy octal escape: up to three digits, and never above \377.
			const digits = /^[0-3][0-7]{0,2}|^[4-7][0-7]?/.exec(pattern.slice(index))[0];

			index += digits.length;

			return singleton(parseInt(digits, 8));
		}

		index += 1;

		if (escaped === 'x' || escaped === 'u') {
			const width = escaped === 'x' ? 2 : 4;
			const digits = pattern.slice(index, index + width);

			if (digits.length === width && /^[0-9a-fA-F]+$/.test(digits)) {
				index += width;
				return singleton(parseInt(digits, 16));
			}

			// Too few hex digits: without `u` the escape is the letter itself, and what follows is read
			// on its own — including a `{…}` that is a quantifier.
			return singleton(escaped.charCodeAt(0));
		}

		return escapeSet(escaped, inClass);
	};

	/**
	 * Reads a `[...]` class and answers the code units it admits.
	 *
	 * A negated class is answered as the complement of what it lists rather than as "any character",
	 * because the difference decides whether a pattern such as `[^@]+@[^@]+` is refused. It is not
	 * case-folded: under `i` a negated class matches *fewer* characters than it lists the complement
	 * of, so the unfolded complement is already the wider reading.
	 *
	 * @returns The set.
	 */
	const readCharacterClass = (): ICharSet => {
		index += 1;

		const negated = peek() === '^';

		if (negated) {
			index += 1;
		}

		let members = emptySet();

		while (index < pattern.length && peek() !== ']') {
			const low = readClassMember();

			if (peek() === '-' && index + 1 < pattern.length && pattern[index + 1] !== ']') {
				index += 1;

				const high = readClassMember();
				const from = singleCodeUnit(low);
				const to = singleCodeUnit(high);

				// A range needs a single character at both ends. With a class escape at either end,
				// JavaScript without `u` reads the dash as itself: `[\d-z]` is `\d`, `-` and `z`.
				members =
					from !== null && to !== null
						? union(members, fromRanges([[Math.min(from, to), Math.max(from, to)]]))
						: union(union(union(members, low), singleton(0x2d)), high);

				continue;
			}

			members = union(members, low);
		}

		if (peek() !== ']') {
			throw new PatternRefusal(
				PatternRejection.SYNTAX,
				'The MATCHES pattern has a character class that is never closed.'
			);
		}

		index += 1;

		return negated ? complementOf(members) : folded(members);
	};

	/**
	 * @returns The set one member of a class admits: an escape, or a single literal character.
	 */
	const readClassMember = (): ICharSet => {
		if (peek() === '\\') {
			return readEscape(true);
		}

		const code = pattern.charCodeAt(index);

		index += 1;

		return singleton(code);
	};

	/**
	 * Reads the quantifier that follows an atom, when there is one.
	 *
	 * @param atom The atom the quantifier applies to.
	 * @returns The atom, wrapped in a repetition when one was stated.
	 */
	const readQuantifier = (atom: PatternNode): PatternNode => {
		const character = peek();
		let min: number;
		let max: number;

		if (character === '*') {
			index += 1;
			min = 0;
			max = Number.POSITIVE_INFINITY;
		} else if (character === '+') {
			index += 1;
			min = 1;
			max = Number.POSITIVE_INFINITY;
		} else if (character === '?') {
			index += 1;
			min = 0;
			max = 1;
		} else if (character === '{') {
			const bounds = readBraceQuantifier();

			if (!bounds) {
				// `{` that is not a quantifier is an ordinary literal in JavaScript without `u`, and the
				// atom it follows keeps its own shape.
				return atom;
			}

			min = bounds.min;
			max = bounds.max;
		} else {
			return atom;
		}

		// `??`, `*?` and `+?` are the lazy forms of the same quantifier. Laziness changes the order the
		// engine tries alternatives in, never how many there are, so it is read and discarded.
		if (peek() === '?') {
			index += 1;
		}

		if (min > RULE_MAX_PATTERN_REPETITION || (Number.isFinite(max) && max > RULE_MAX_PATTERN_REPETITION)) {
			throw new PatternRefusal(
				PatternRejection.TOO_COMPLEX,
				`A MATCHES pattern repeats at most ${RULE_MAX_PATTERN_REPETITION} times; this one states ${
					Number.isFinite(max) ? max : min
				}.`
			);
		}

		const node: PatternNode = { kind: 'repeat', body: atom, min, max };

		if (isChoice(node)) {
			counters.loops += 1;
		}

		counters.nodes += 1;

		return node;
	};

	/**
	 * Reads a `{n}`, `{n,}` or `{n,m}` quantifier.
	 *
	 * @returns The bounds, or undefined when the brace is an ordinary literal.
	 */
	const readBraceQuantifier = (): { min: number; max: number } | undefined => {
		const match = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(index));

		if (!match) {
			return undefined;
		}

		index += match[0].length;

		const min = Number(match[1]);

		if (match[2] === undefined) {
			return { min, max: min };
		}

		return { min, max: match[3] === '' ? Number.POSITIVE_INFINITY : Number(match[3]) };
	};

	const alternatives = readAlternation(0);

	if (index < pattern.length) {
		throw new PatternRefusal(PatternRejection.SYNTAX, 'The MATCHES pattern closes a group it never opened.');
	}

	return { alternatives, counters };
}

/**
 * Whether a repetition makes a choice: how many times to go round, or — for an exact repetition — a
 * choice inside what it repeats.
 *
 * `{3}` repeats exactly three times: the engine has no choice about how many times to go round, and
 * `x{3}` is simply `xxx`. **Unless what it repeats already contains a choice.** `(?:.*a){20}` has no
 * variable quantifier on the outside, and yet it is twenty nested `.*`s: each copy may end anywhere,
 * and the ways of splitting one subject between twenty of them is the same explosion a nested loop
 * produces.
 *
 * @param node The repetition.
 * @returns True when the repetition multiplies the engine's choices.
 */
function isChoice(node: Extract<PatternNode, { kind: 'repeat' }>): boolean {
	return node.min !== node.max || (node.max > 1 && hasChoice(node.body));
}

/**
 * @param node The repetition.
 * @returns True when the repetition is a loop: a choice the engine may take round more than once.
 */
function isLoop(node: Extract<PatternNode, { kind: 'repeat' }>): boolean {
	return node.max >= 2 && isChoice(node);
}

/**
 * @param nodes A sequence.
 * @returns The sequence as the engine walks it from right to left.
 */
function reverseSequence(nodes: PatternNode[]): PatternNode[] {
	return [...nodes].reverse().map(reverseNode);
}

/**
 * @param node A node.
 * @returns The node as the engine walks it from right to left. A lookaround inside is left as it is:
 * the engine runs a lookahead forwards and a lookbehind backwards wherever it sits, and a lookbehind
 * was already reversed when it was read.
 */
function reverseNode(node: PatternNode): PatternNode {
	switch (node.kind) {
		case 'group':
			return node.lookaround ? node : { ...node, alternatives: node.alternatives.map(reverseSequence) };
		case 'repeat':
			return { ...node, body: reverseNode(node.body) };
		default:
			return node;
	}
}

/**
 * @param node The node to inspect.
 * @returns True when matching the node involves a choice the engine may have to revisit — a variable
 * repetition, or an alternation with more than one branch, at any depth inside it — or a scanning
 * lookaround, which costs what a repetition does every time it is reached.
 */
function hasChoice(node: PatternNode): boolean {
	switch (node.kind) {
		case 'char':
		case 'assertion':
			return false;
		case 'group':
			return (
				node.alternatives.length > 1 ||
				node.alternatives.some((branch) => branch.some(hasChoice)) ||
				isScanningLookaround(node)
			);
		case 'repeat':
			return node.min !== node.max || hasChoice(node.body);
		default:
			return true;
	}
}

/**
 * @param node The node to inspect.
 * @returns True when a repetition that makes a choice, or a scanning lookaround, sits anywhere inside
 * the node, or is the node.
 */
function containsChoiceRepetition(node: PatternNode): boolean {
	switch (node.kind) {
		case 'group':
			return isScanningLookaround(node) || node.alternatives.some((branch) => branch.some(containsChoiceRepetition));
		case 'repeat':
			return isChoice(node) || containsChoiceRepetition(node.body);
		default:
			return false;
	}
}

/**
 * Whether a lookaround costs more than a character does each time the engine reaches it.
 *
 * A lookaround is run to completion wherever it is reached and consumes nothing, so its cost is not
 * paid once per character of the subject but once per *visit*. One that examines a single character
 * — `(?=\d)`, `(?<!-)` — costs what that character would. One that can make a choice, or examine more
 * than one character, reads up to its own width every visit: `(?=[^!]{200})` inside a loop turns a
 * linear loop into one that reads two hundred characters per repetition, and behind a sliding pair it
 * is the third degree of a cubic.
 *
 * @param node The node.
 * @returns True when the node is a lookaround that makes a choice or can examine more than one
 * character.
 */
function isScanningLookaround(node: PatternNode): boolean {
	if (node.kind !== 'group' || !node.lookaround) {
		return false;
	}

	const body: PatternNode = { kind: 'group', alternatives: node.alternatives, lookaround: false };

	return !isDeterministic(body) || widthOf(body) > 1;
}

/**
 * @param node The node.
 * @returns The most characters the node can consume, and infinity when a repetition in it is
 * unbounded. A lookaround consumes nothing; what it examines is accounted for by
 * {@link isScanningLookaround}.
 */
function widthOf(node: PatternNode): number {
	switch (node.kind) {
		case 'char':
			return 1;
		case 'assertion':
			return 0;
		case 'group':
			return node.lookaround
				? 0
				: node.alternatives.reduce(
						(widest, branch) => Math.max(widest, branch.reduce((sum, child) => sum + widthOf(child), 0)),
						0
				  );
		case 'repeat': {
			const body = widthOf(node.body);

			return body === 0 || node.max === 0 ? 0 : body * node.max;
		}
		default:
			return Number.POSITIVE_INFINITY;
	}
}

/**
 * Whether the node can match, from any one position, in at most one way.
 *
 * True for a character, an assertion and a lookaround that does not scan (the engine never backtracks
 * into one), for an exact repetition of something deterministic, and for a group whose every branch
 * is deterministic and whose branches — when there is more than one — begin with characters no other
 * branch can begin with and cannot match nothing. The engine then knows from the next character which
 * branch it is in.
 *
 * A scanning lookaround is answered as not deterministic although it matches in one way at most,
 * because what this answers is whether a node may stand on a path as a single step, and a lookaround
 * that reads ahead on every visit may not: a group that holds one is unfolded, so that the lookaround
 * is counted where it sits.
 *
 * @param node The node.
 * @returns True when the node is deterministic.
 */
function isDeterministic(node: PatternNode): boolean {
	switch (node.kind) {
		case 'char':
		case 'assertion':
			return true;
		case 'group':
			if (node.lookaround) {
				return !isScanningLookaround(node);
			}

			return (
				node.alternatives.every((branch) => branch.every(isDeterministic)) &&
				(node.alternatives.length === 1 || branchesAreDisjoint(node.alternatives))
			);
		case 'repeat':
			return node.min === node.max && isDeterministic(node.body);
		default:
			return false;
	}
}

/**
 * @param alternatives The branches of one alternation.
 * @returns True when no branch can match nothing and no two branches can begin with the same
 * character.
 */
function branchesAreDisjoint(alternatives: PatternNode[][]): boolean {
	if (alternatives.some((branch) => branch.every(isNullable))) {
		return false;
	}

	const firsts = alternatives.map(firstSetOfSequence);

	for (let left = 0; left < firsts.length; left += 1) {
		for (let right = left + 1; right < firsts.length; right += 1) {
			if (intersects(firsts[left], firsts[right])) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Refuses a choice inside a loop, an overlapping alternation inside a loop, and a loop over something
 * that can match nothing — bounds (1) and (2) of the file comment.
 *
 * @param node The node.
 * @param insideLoop Whether the node sits inside a loop's scope.
 * @throws PatternRefusal when the node breaks one of the bounds.
 */
function assertLoopsDeterministic(node: PatternNode, insideLoop: boolean): void {
	switch (node.kind) {
		case 'char':
		case 'assertion':
			return;

		case 'group':
			if (insideLoop && node.alternatives.length > 1) {
				assertBranchesDisjointInLoop(node.alternatives);
			}

			for (const branch of node.alternatives) {
				for (const child of branch) {
					assertLoopsDeterministic(child, insideLoop);
				}
			}

			if (insideLoop && isScanningLookaround(node)) {
				// Reached after the body's own choices were refused above, so what is left is a lookaround
				// that makes no choice but reads more than one character: `(?:(?=[^!]{200})[^!])*` reads
				// two hundred characters on every repetition, and a loop beside it multiplies that again.
				throw new PatternRefusal(
					PatternRejection.SCANNING_LOOKAROUND,
					'A MATCHES pattern cannot repeat a lookaround that examines more than one character: the engine runs it again on every repetition.'
				);
			}

			return;

		case 'repeat': {
			const choice = isChoice(node);
			const loop = isLoop(node);

			if (choice && insideLoop) {
				// Star height two. `((a)*)*`, `(a+)+`, `(?:a?)*`, `(?:ab?)+` and every relative of theirs
				// land here: the engine may choose how many times to go round the inner loop *and* the
				// outer one, and the number of ways to split one input between them grows exponentially.
				throw new PatternRefusal(
					PatternRejection.STAR_HEIGHT,
					'A MATCHES pattern cannot repeat something that itself repeats or is optional: the two choices multiply, and the match can take exponential time.'
				);
			}

			if (loop && isNullable(node.body)) {
				// A loop over something that can match nothing has a choice point at every position,
				// whatever it is made of.
				throw new PatternRefusal(
					PatternRejection.NULLABLE_REPETITION,
					'A MATCHES pattern cannot repeat something that can match nothing.'
				);
			}

			assertLoopsDeterministic(node.body, insideLoop || loop);

			return;
		}

		default:
			return;
	}
}

/**
 * Refuses an alternation inside a loop whose branches can match the same input.
 *
 * The test is on the characters each branch can *begin* with — a prefix test rather than a
 * language-intersection test, so `(?:ab|ac)+` is refused although it is deterministic. Two branches
 * that share a possible first character are refused, and so is a branch that can match nothing,
 * because an empty branch overlaps with every other one at every position.
 *
 * @param alternatives The branches.
 * @throws PatternRefusal when two branches overlap.
 */
function assertBranchesDisjointInLoop(alternatives: PatternNode[][]): void {
	if (alternatives.some((branch) => branch.every(isNullable))) {
		throw new PatternRefusal(
			PatternRejection.AMBIGUOUS_ALTERNATION,
			'A MATCHES pattern cannot repeat an alternation one of whose branches matches nothing.'
		);
	}

	if (!branchesAreDisjoint(alternatives)) {
		throw new PatternRefusal(
			PatternRejection.AMBIGUOUS_ALTERNATION,
			'A MATCHES pattern cannot repeat an alternation whose branches can begin with the same character: the engine has to try both at every position, and the attempts multiply.'
		);
	}
}

/**
 * Refuses a pattern with more ways of reaching the same point, outside its loops, than the budget —
 * bound (4) of the file comment.
 *
 * An overlapping alternation multiplies by its branch count, and an optional part that wraps a
 * repetition or can match nothing multiplies by two. The product is taken over the whole tree,
 * lookarounds included, because duplicates multiply across separators: `(?:a|a)!(?:a|a)!` has four
 * ways to reach its end, not two.
 *
 * @param root The pattern's root.
 * @throws PatternRefusal when the product exceeds {@link RULE_MAX_PATTERN_AMBIGUITY}.
 */
function assertAmbiguityWithinBudget(root: PatternNode): void {
	const product = ambiguityOf(root, false);

	if (product > RULE_MAX_PATTERN_AMBIGUITY) {
		throw new PatternRefusal(
			PatternRejection.AMBIGUOUS_ALTERNATION,
			`A MATCHES pattern may have at most ${RULE_MAX_PATTERN_AMBIGUITY} ways of reaching the same point; the overlapping alternatives and optional parts of this one allow ${product}, and the engine tries every one of them before it gives up.`
		);
	}
}

/**
 * @param node The node.
 * @param insideLoop Whether the node sits inside a loop's scope, where an overlapping alternation has
 * already been refused and so contributes nothing here.
 * @returns The product of the duplicate-path factors inside the node, capped just above the budget so
 * that a hostile pattern cannot overflow it.
 */
function ambiguityOf(node: PatternNode, insideLoop: boolean): number {
	switch (node.kind) {
		case 'group': {
			let product = 1;

			for (const branch of node.alternatives) {
				for (const child of branch) {
					product = Math.min(product * ambiguityOf(child, insideLoop), RULE_MAX_PATTERN_AMBIGUITY + 1);
				}
			}

			if (!insideLoop && node.alternatives.length > 1 && !branchesAreDisjoint(node.alternatives)) {
				product *= node.alternatives.length;
			}

			return Math.min(product, RULE_MAX_PATTERN_AMBIGUITY + 1);
		}

		case 'repeat': {
			let product = ambiguityOf(node.body, insideLoop || isLoop(node));

			if (
				!insideLoop &&
				node.min === 0 &&
				node.max === 1 &&
				(containsChoiceRepetition(node.body) || isNullable(node.body))
			) {
				// Taking the optional part and leaving it out can reach the same point.
				product *= 2;
			}

			return Math.min(product, RULE_MAX_PATTERN_AMBIGUITY + 1);
		}

		default:
			return 1;
	}
}

/**
 * Refuses a lookaround whose body holds a sliding pair — bound (5) of the file comment.
 *
 * @param node The node to search for lookarounds.
 * @throws PatternRefusal when a lookaround's own body has two repetitions that can slide.
 */
function assertLookaroundsLinear(node: PatternNode): void {
	switch (node.kind) {
		case 'group':
			if (node.lookaround) {
				// One repetition inside a lookaround is linear per visit; a sliding pair is quadratic per
				// visit, and the visits are multiplied by whatever slides before the lookaround.
				assertPathsSlideAtMostOnce(node.alternatives, 1);
			}

			for (const branch of node.alternatives) {
				for (const child of branch) {
					assertLookaroundsLinear(child);
				}
			}

			return;

		case 'repeat':
			assertLookaroundsLinear(node.body);
			return;

		default:
			return;
	}
}

/**
 * Refuses more than `limit` repetitions that can divide one stretch of the subject between them, on
 * any path the alternatives unfold into — bound (3) of the file comment.
 *
 * `a*a*b` is the smallest example and `.*a.*a.*a.*b` is the one that hurts: the engine has to try
 * every way of dividing the subject between the repetitions, which is a polynomial of degree *k* for
 * *k* sliding repetitions. Over the {@link RULE_MAX_MATCH_INPUT}-character subject the platform
 * allows, two of them is a quarter of a million steps and four of them is billions.
 *
 * The boundary between two repetitions is fixed when something *between* them must consume a
 * character the first repetition can never consume: the first cannot run past it, so the split is
 * decided rather than searched for. That is what keeps `[a-z]+@[a-z]+` and `[^@]+@[^@]+` legal. It is
 * a *disjointness* test and not a containment one: in `[a-c]+[b-d][a-c]+`, `[b-d]` is not contained in
 * `[a-c]`, yet every `b` in the subject is a place the boundary can sit.
 *
 * The check runs on unfolded paths rather than on the tree, because a group hides nothing from the
 * engine: `.*(?:.*(?:.*x))` is `.*.*.*x`, and a group that holds a repetition is spliced into the path
 * around it.
 *
 * A unit that does not slide but re-reads the subject on every visit — a scanning lookaround, or an
 * exact repetition such as `a{250}` — takes part too, because what matters is how often it is
 * reached times what it reads each time. See {@link countSlidingRepetitions}.
 *
 * @param alternatives The alternatives to unfold.
 * @param limit How many repetitions on one path may share a sliding boundary.
 * @throws PatternRefusal when a path exceeds the limit, or the paths exceed
 * {@link RULE_MAX_PATTERN_PATHS}.
 */
function assertPathsSlideAtMostOnce(alternatives: PatternNode[][], limit: number): void {
	const paths: IPathUnit[][] = [];

	for (const branch of alternatives) {
		paths.push(...unfoldSequence(branch));

		if (paths.length > RULE_MAX_PATTERN_PATHS) {
			throw tooManyPaths();
		}
	}

	for (const path of paths) {
		const sliding = countSlidingRepetitions(path);

		if (sliding > limit) {
			throw new PatternRefusal(
				PatternRejection.SLIDING_REPETITION,
				limit < MAX_SLIDING_REPETITIONS
					? 'A MATCHES pattern cannot hold, inside a lookaround, two repetitions that can consume the same text with nothing between them to fix the boundary: the lookaround is run again at every position the engine reaches it.'
					: `A MATCHES pattern holds at most ${limit} repetitions — counting lookarounds and exact repetitions that re-read the text — that can consume the same text with nothing between them to fix the boundary; this one holds ${sliding}, and the engine has to try every way of dividing the subject between them.`
			);
		}
	}
}

/**
 * Counts the units of one path that share a sliding boundary.
 *
 * Two sliding repetitions pair when they can consume a common character and nothing between them fixes
 * where the first one stops. A unit that re-reads the subject without sliding — a scanning lookaround,
 * an exact repetition — pairs with the sliding repetition before it on what it costs rather than on
 * what it consumes, since the cost is what it reads on each visit times how often it is visited:
 *
 * - *behind a pair*, it is visited once for every way the pair can divide the subject, so anything it
 *   reads beyond a single character is a third degree: `.*.*a{250}x` and `.*.*(?=\d+)` are cubic;
 * - behind a single repetition, it is visited once per position that repetition can stop at, so it
 *   is a second degree only when it reads more than {@link MAX_CONSTANT_SCAN_WIDTH} characters, and a
 *   constant factor otherwise: `.*\d{3}-\d{4}` is linear.
 *
 * It is never the left of a pair: the engine does not backtrack into a lookaround, and an exact
 * repetition has only one way to match, so neither gives what follows it anything more to try.
 *
 * @param path One unfolded path.
 * @returns How many of its units take part in at least one pair whose boundary can slide.
 */
function countSlidingRepetitions(path: IPathUnit[]): number {
	const involved = new Set<number>();

	for (let left = 0; left < path.length; left += 1) {
		if (!path[left].sliding) {
			continue;
		}

		// Walking right from the left repetition, the boundary is fixed by the first unit that must
		// begin with a character the left repetition cannot consume — that unit included, when it is a
		// repetition itself: `[ab]*c+` cannot slide, because `c+` has to start where `[ab]*` stops.
		let fixed = false;
		let paired = false;

		for (let right = left + 1; right < path.length && !fixed; right += 1) {
			const unit = path[right];

			fixed = unit.mandatory && !intersects(unit.first, path[left].consumes);

			if (fixed) {
				continue;
			}

			const slides = unit.sliding && intersects(path[left].consumes, unit.consumes);
			const rescans = unit.scan !== undefined && (paired || unit.scan > MAX_CONSTANT_SCAN_WIDTH);

			if (slides || rescans) {
				involved.add(left);
				involved.add(right);
			}

			paired = paired || slides;
		}
	}

	return involved.size;
}

/**
 * @returns The refusal for a pattern that unfolds into too many paths.
 */
function tooManyPaths(): PatternRefusal {
	return new PatternRefusal(
		PatternRejection.TOO_COMPLEX,
		`A MATCHES pattern may unfold into at most ${RULE_MAX_PATTERN_PATHS} paths through its alternatives and optional parts.`
	);
}

/**
 * Unfolds a sequence into the paths through it.
 *
 * @param nodes The sequence.
 * @returns Every path, as the units the sliding check reads.
 * @throws PatternRefusal when the paths exceed {@link RULE_MAX_PATTERN_PATHS}.
 */
function unfoldSequence(nodes: PatternNode[]): IPathUnit[][] {
	let paths: IPathUnit[][] = [[]];

	for (const node of nodes) {
		const variants = unfoldNode(node);

		if (variants.length === 1) {
			for (const path of paths) {
				path.push(...variants[0]);
			}

			continue;
		}

		const next: IPathUnit[][] = [];

		for (const path of paths) {
			for (const variant of variants) {
				next.push([...path, ...variant]);

				if (next.length > RULE_MAX_PATTERN_PATHS) {
					throw tooManyPaths();
				}
			}
		}

		paths = next;
	}

	return paths;
}

/**
 * Unfolds one node into the variants a path may take through it.
 *
 * A group that is deterministic, and an exact repetition of one, stays a single unit: whichever
 * branch the engine takes, it is decided by the next character, so there is nothing to unfold — but
 * the unit carries what it re-reads on each visit when an exact repetition sits in it. A group that is
 * not is spliced branch by branch into the path around it. An optional part that wraps
 * a repetition becomes two variants, with and without it. A loop, and an optional part that does not
 * wrap a repetition, is a unit whose boundary can slide.
 *
 * @param node The node.
 * @returns The variants, each a run of units.
 */
function unfoldNode(node: PatternNode): IPathUnit[][] {
	switch (node.kind) {
		case 'char':
			return [[{ sliding: false, mandatory: true, first: node.set, consumes: node.set }]];

		case 'assertion':
			return [[]];

		case 'group':
			if (node.lookaround) {
				// Zero-width, and free when it reads one character. One that scans reads the subject every
				// time it is reached, which is what its unit records.
				return isScanningLookaround(node)
					? [[{ sliding: false, mandatory: false, first: emptySet(), consumes: emptySet(), scan: lookaroundScanOf(node) }]]
					: [[]];
			}

			if (isDeterministic(node)) {
				return [[unitOf(node, false, true, countedScanOf(node))]];
			}

			return node.alternatives.flatMap((branch) => unfoldSequence(branch));

		case 'repeat':
			if (node.max === 0) {
				return [[]];
			}

			if (isLoop(node)) {
				return [[unitOf(node.body, true, node.min >= 1)]];
			}

			if (isChoice(node)) {
				// An optional part: `min` is 0 and `max` is 1.
				return containsChoiceRepetition(node.body)
					? [[], ...unfoldNode(node.body)]
					: [[unitOf(node.body, true, false)]];
			}

			return node.min === 1 ? unfoldNode(node.body) : [[unitOf(node.body, false, true, countedScanOf(node))]];

		default:
			return [[unitOf(node, true, false)]];
	}
}

/**
 * @param node What the unit consumes.
 * @param sliding Whether the unit's length varies.
 * @param required Whether the unit is required at least once; it is still not mandatory when the node
 * can match nothing.
 * @param scan What the unit re-reads on every visit, when it is a counted repetition or holds one.
 * @returns The unit.
 */
function unitOf(node: PatternNode, sliding: boolean, required = true, scan?: number): IPathUnit {
	return {
		sliding,
		mandatory: required && !isNullable(node),
		first: firstSetOfNode(node),
		consumes: consumableSetOfNode(node),
		...(scan === undefined ? {} : { scan })
	};
}

/**
 * @param node A scanning lookaround.
 * @returns The most characters it reads on one visit: its width when it makes no choice, and infinity
 * when it does, because a choice inside it can run to the end of the subject.
 */
function lookaroundScanOf(node: Extract<PatternNode, { kind: 'group' }>): number {
	const body: PatternNode = { kind: 'group', alternatives: node.alternatives, lookaround: false };

	return isDeterministic(body) ? widthOf(body) : Number.POSITIVE_INFINITY;
}

/**
 * What a unit that does not slide re-reads on every visit because of an exact repetition in it.
 *
 * `x{3}` is `xxx` to the engine's *matching*, but not to its *cost*: V8 runs a counted repetition as a
 * loop, so `a{250}` is two hundred and fifty steps on every visit however few characters it took to
 * write, where two hundred and fifty literal characters would have used the whole pattern. A run of
 * single characters is left as it is: the pattern's own length bounds it.
 *
 * @param node A node that stands on its path as a single unit.
 * @returns The node's width when an exact repetition that reads more than one character sits in it —
 * outside any lookaround, which is accounted for by {@link lookaroundScanOf} — and undefined otherwise.
 */
function countedScanOf(node: PatternNode): number | undefined {
	const holdsCountedRepetition = (inner: PatternNode): boolean => {
		switch (inner.kind) {
			case 'group':
				return !inner.lookaround && inner.alternatives.some((branch) => branch.some(holdsCountedRepetition));
			case 'repeat':
				return (inner.min === inner.max && inner.max >= 2 && widthOf(inner) > 1) || holdsCountedRepetition(inner.body);
			default:
				return false;
		}
	};

	return holdsCountedRepetition(node) ? widthOf(node) : undefined;
}

/**
 * @param node The node.
 * @returns True when the node can match the empty string.
 */
function isNullable(node: PatternNode): boolean {
	switch (node.kind) {
		case 'char':
			return false;
		case 'assertion':
			return true;
		case 'group':
			// A lookaround consumes nothing, so it always matches empty.
			return node.lookaround || node.alternatives.some((branch) => branch.every(isNullable));
		case 'repeat':
			return node.min === 0 || isNullable(node.body);
		default:
			return true;
	}
}

/**
 * The characters a branch can begin with.
 *
 * @param nodes The branch.
 * @returns The union of the first-character sets of its leading nodes, up to and including the first
 * one that must consume something.
 */
function firstSetOfSequence(nodes: PatternNode[]): ICharSet {
	let result = emptySet();

	for (const node of nodes) {
		result = union(result, firstSetOfNode(node));

		if (!isNullable(node)) {
			break;
		}
	}

	return result;
}

/**
 * @param node The node.
 * @returns The characters the node can begin with.
 */
function firstSetOfNode(node: PatternNode): ICharSet {
	switch (node.kind) {
		case 'char':
			return node.set;
		case 'assertion':
			return emptySet();
		case 'group':
			// A lookaround constrains what follows without consuming it. Treating it as beginning with
			// nothing keeps the walk moving to the node that does consume.
			return node.lookaround
				? emptySet()
				: node.alternatives.reduce((set, branch) => union(set, firstSetOfSequence(branch)), emptySet());
		case 'repeat':
			return node.max === 0 ? emptySet() : firstSetOfNode(node.body);
		default:
			return anySet();
	}
}

/**
 * @param node The node.
 * @returns Every character the node can consume, wherever in its match.
 */
function consumableSetOfNode(node: PatternNode): ICharSet {
	switch (node.kind) {
		case 'char':
			return node.set;
		case 'assertion':
			return emptySet();
		case 'group':
			return node.lookaround
				? emptySet()
				: node.alternatives.reduce(
						(set, branch) => branch.reduce((inner, child) => union(inner, consumableSetOfNode(child)), set),
						emptySet()
				  );
		case 'repeat':
			return node.max === 0 ? emptySet() : consumableSetOfNode(node.body);
		default:
			return anySet();
	}
}

/**
 * @returns A set that admits every code unit.
 */
function anySet(): ICharSet {
	return { complement: true, ranges: [] };
}

/**
 * @returns A set that admits nothing.
 */
function emptySet(): ICharSet {
	return { complement: false, ranges: [] };
}

/**
 * @param code A code unit.
 * @returns The set holding exactly it.
 */
function singleton(code: number): ICharSet {
	return { complement: false, ranges: [[code, code]] };
}

/**
 * @param ranges Inclusive code-unit ranges, in any order.
 * @returns The set holding exactly them.
 */
function fromRanges(ranges: ReadonlyArray<readonly [number, number]>): ICharSet {
	return { complement: false, ranges: normalize(ranges) };
}

/**
 * @param set A set.
 * @returns The code unit, when the set holds exactly one; otherwise null.
 */
function singleCodeUnit(set: ICharSet): number | null {
	return !set.complement && set.ranges.length === 1 && set.ranges[0][0] === set.ranges[0][1]
		? set.ranges[0][0]
		: null;
}

/**
 * @param set A set.
 * @returns Everything the set does not admit.
 */
function complementOf(set: ICharSet): ICharSet {
	return { complement: !set.complement, ranges: set.ranges };
}

/**
 * @param ranges Inclusive ranges, in any order and possibly overlapping.
 * @returns The same code units as sorted, disjoint, non-adjacent ranges.
 */
function normalize(ranges: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
	const sorted = [...ranges].sort((left, right) => left[0] - right[0]);
	const merged: Array<[number, number]> = [];

	for (const [low, high] of sorted) {
		const last = merged[merged.length - 1];

		if (last && low <= last[1] + 1) {
			last[1] = Math.max(last[1], high);
		} else {
			merged.push([low, high]);
		}
	}

	return merged;
}

/**
 * @param left Normalized ranges.
 * @param right Normalized ranges.
 * @returns The code units both admit.
 */
function intersectRanges(
	left: ReadonlyArray<readonly [number, number]>,
	right: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> {
	const result: Array<[number, number]> = [];

	for (const [leftLow, leftHigh] of left) {
		for (const [rightLow, rightHigh] of right) {
			const low = Math.max(leftLow, rightLow);
			const high = Math.min(leftHigh, rightHigh);

			if (low <= high) {
				result.push([low, high]);
			}
		}
	}

	return normalize(result);
}

/**
 * @param from Normalized ranges.
 * @param remove Normalized ranges.
 * @returns The code units of `from` that `remove` does not admit.
 */
function subtractRanges(
	from: ReadonlyArray<readonly [number, number]>,
	remove: ReadonlyArray<readonly [number, number]>
): Array<[number, number]> {
	let result = from.map(([low, high]): [number, number] => [low, high]);

	for (const [removeLow, removeHigh] of remove) {
		const next: Array<[number, number]> = [];

		for (const [low, high] of result) {
			if (removeHigh < low || removeLow > high) {
				next.push([low, high]);
				continue;
			}

			if (low < removeLow) {
				next.push([low, removeLow - 1]);
			}

			if (high > removeHigh) {
				next.push([removeHigh + 1, high]);
			}
		}

		result = next;
	}

	return result;
}

/**
 * @param left One set.
 * @param right Another set.
 * @returns Every code unit either admits, exactly.
 */
function union(left: ICharSet, right: ICharSet): ICharSet {
	if (!left.complement && !right.complement) {
		return fromRanges([...left.ranges, ...right.ranges]);
	}

	if (left.complement && right.complement) {
		// ¬A ∪ ¬B = ¬(A ∩ B).
		return { complement: true, ranges: intersectRanges(left.ranges, right.ranges) };
	}

	// ¬A ∪ B = ¬(A − B).
	const [negative, positive] = left.complement ? [left, right] : [right, left];

	return { complement: true, ranges: subtractRanges(negative.ranges, positive.ranges) };
}

/**
 * @param left One set.
 * @param right Another set.
 * @returns True when a code unit exists that both sets admit.
 */
function intersects(left: ICharSet, right: ICharSet): boolean {
	if (!left.complement && !right.complement) {
		return intersectRanges(left.ranges, right.ranges).length > 0;
	}

	if (left.complement && right.complement) {
		// ¬A ∩ ¬B = ¬(A ∪ B), which is empty only when A and B between them exclude every code unit.
		const excluded = normalize([...left.ranges, ...right.ranges]);

		return !(excluded.length === 1 && excluded[0][0] <= 0 && excluded[0][1] >= MAX_CODE_UNIT);
	}

	const [negative, positive] = left.complement ? [left, right] : [right, left];

	return subtractRanges(positive.ranges, negative.ranges).length > 0;
}

/**
 * Widens a set to everything the `i` flag lets it match.
 *
 * Without `u`, `i` compares characters by their upper-case form and never lets a character outside
 * ASCII match one inside it. The ASCII letters are therefore folded exactly, and anything outside
 * ASCII is widened to all of it — the reading that refuses rather than admits. A complement is left
 * alone: a class escape such as `\W` matches the same characters under `i`, and a negated class
 * matches fewer.
 *
 * @param set A set a literal, an escape or a class admits.
 * @returns The widened set.
 */
function foldCase(set: ICharSet): ICharSet {
	if (set.complement) {
		return set;
	}

	const added: Array<[number, number]> = [];

	for (const [low, high] of set.ranges) {
		const upper = intersectRanges([[low, high]], [[0x41, 0x5a]]);
		const lower = intersectRanges([[low, high]], [[0x61, 0x7a]]);

		added.push(...upper.map(([from, to]): [number, number] => [from + 0x20, to + 0x20]));
		added.push(...lower.map(([from, to]): [number, number] => [from - 0x20, to - 0x20]));

		if (high > 0x7f) {
			added.push([0x80, MAX_CODE_UNIT]);
		}
	}

	return fromRanges([...set.ranges, ...added]);
}

/** What `\s` matches: WhiteSpace and LineTerminator, exactly as the engine defines them. */
const WHITESPACE: ReadonlyArray<readonly [number, number]> = [
	[0x09, 0x0d],
	[0x20, 0x20],
	[0xa0, 0xa0],
	[0x1680, 0x1680],
	[0x2000, 0x200a],
	[0x2028, 0x2029],
	[0x202f, 0x202f],
	[0x205f, 0x205f],
	[0x3000, 0x3000],
	[0xfeff, 0xfeff]
];

/** What `\w` matches without `u`. */
const WORD: ReadonlyArray<readonly [number, number]> = [
	[0x30, 0x39],
	[0x41, 0x5a],
	[0x5f, 0x5f],
	[0x61, 0x7a]
];

/** What `\d` matches. */
const DIGIT: ReadonlyArray<readonly [number, number]> = [[0x30, 0x39]];

/**
 * The characters an escape sequence admits, for every escape {@link parsePattern} does not read itself.
 *
 * The class escapes are exact, because the negated ones are complements and a complement is only a
 * superset of what the engine matches when what it excludes is no wider than what the engine
 * excludes. An escape that is not one of JavaScript's is, without `u`, the character itself.
 *
 * @param escaped The character after the backslash.
 * @param inClass Whether the escape sits inside a `[...]`.
 * @returns The set.
 */
function escapeSet(escaped: string, inClass: boolean): ICharSet {
	switch (escaped) {
		case 'd':
			return fromRanges(DIGIT);
		case 'D':
			return complementOf(fromRanges(DIGIT));
		case 'w':
			return fromRanges(WORD);
		case 'W':
			return complementOf(fromRanges(WORD));
		case 's':
			return fromRanges(WHITESPACE);
		case 'S':
			return complementOf(fromRanges(WHITESPACE));
		case 'b':
			// Only reachable inside a class, where `\b` is a backspace rather than a word boundary.
			return inClass ? singleton(0x08) : anySet();
		case 'f':
			return singleton(0x0c);
		case 'n':
			return singleton(0x0a);
		case 'r':
			return singleton(0x0d);
		case 't':
			return singleton(0x09);
		case 'v':
			return singleton(0x0b);
		default:
			return singleton(escaped.charCodeAt(0));
	}
}
