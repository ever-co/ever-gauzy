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
 * kept. The second was meant to catch a quantified group whose body is itself quantified, and
 * `[^)]*` cannot cross a `)`, so it only ever saw a quantifier directly inside a *flat* group. Every
 * canonical evil pattern walked past it:
 *
 * - `(a|a)+$` and `(a|a?)+$` — a quantified group whose alternatives match the same input, with no
 *   nested quantifier anywhere for the heuristic to find;
 * - `((a)*)*` — the inner quantifier is behind a nested `)`;
 * - `(a|ab)*`, `(x|xy|xyz)+`, `(\d|\w)+` — the same overlap, spelled differently.
 *
 * Each of those takes exponential time on a few dozen characters of input that does not match.
 *
 * ## What this does instead
 *
 * The pattern is parsed into a small tree and four independent bounds are applied to it. They are
 * independent on purpose: each one alone is a heuristic, and the argument that the set is safe rests
 * on the last of them, which is not a heuristic at all.
 *
 * 1. **Star height.** Exponential backtracking needs a choice point inside a loop. A loop inside a
 *    loop is the general way to build one, so a quantifier that can repeat a *variable* number of
 *    times is refused anywhere inside another such quantifier's scope. An exact repetition — `{2}`,
 *    `{4}` — is not a loop: it is an unrolling, it introduces no choice, and refusing it would refuse
 *    ordinary patterns like `(?:[A-Z]{2}-\d{4},)+`, which is linear and legitimate.
 * 2. **Ambiguous alternation inside a loop.** The other way to build a choice point is two branches
 *    of one alternation that can match the same input. Inside a loop, every alternation's branches
 *    are compared by the set of characters each can *begin* with; overlapping branches — and a branch
 *    that can match nothing at all — are refused. Outside a loop an ambiguous alternation is merely a
 *    linear amount of extra work, so it is left alone.
 * 3. **A bounded subject.** {@link RULE_MAX_MATCH_INPUT} caps the text a pattern is ever applied to.
 *    This is the bound that does not depend on the analysis being complete: a pattern that survives
 *    (1) and (2) has no nested loop and no ambiguous loop, so its remaining worst case is polynomial
 *    in the subject length, and the subject length is a constant.
 * 4. **A bounded pattern.** Length, node count, loop count, group count, alternative count, nesting
 *    depth and the repetition counts themselves are all capped, so the parse and the match are both
 *    bounded by construction rather than by the author's restraint.
 *
 * ## What it still cannot catch
 *
 * Stated plainly, because a claim of safety that is not true is worse than a bound that is.
 *
 * - **Ambiguity that shows up after the first character.** Branches are compared by their first-character
 *   sets, so `(?:ab|cb)+` is accepted; it happens to be unambiguous, but the reason this accepts it is
 *   that the test is a prefix test and not a language-intersection test. A hostile pattern whose
 *   branches differ in their first character and collide later would pass. Nothing exponential is
 *   known to be buildable that way under (1), but this is an approximation and not a proof.
 * - **Polynomial blow-up.** `a*a*b` and its relatives are quadratic rather than exponential and are
 *   accepted. Bound (3) is what makes that acceptable: the quadratic is over a 512-character subject,
 *   which is hundreds of thousands of steps, not billions.
 * - **Engine-specific behaviour.** The analysis reasons about the pattern, not about V8's Irregexp. A
 *   future engine optimisation or regression changes the constant, not the shape, but the constant is
 *   what an operator feels.
 * - **Aggregate cost.** One pattern is bounded; a rule set is bounded separately, by
 *   `RULE_MAX_GROUPS` × `RULE_MAX_RULES_PER_GROUP`. The two bounds multiply, and nothing here limits
 *   how many rule sets one request evaluates — that is the caller's budget to keep.
 * - **Constructs deliberately refused rather than analysed.** Backreferences and named
 *   backreferences are refused outright, because their cost is input-dependent in a way no static
 *   shape check can bound. A pattern that needs one has to be expressed another way.
 */

/** How long a subject a `MATCHES` pattern is ever applied to. */
export const RULE_MAX_MATCH_INPUT = 512;

/** The most variable-repetition quantifiers one pattern may declare. */
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
	/** The pattern is not a regular expression this platform can read, or JavaScript cannot compile it. */
	SYNTAX = 'SYNTAX',
	/** The pattern uses a backreference, whose cost depends on the input. */
	BACKREFERENCE = 'BACKREFERENCE',
	/** A repeating quantifier sits inside another repeating quantifier's scope. */
	STAR_HEIGHT = 'STAR_HEIGHT',
	/** Two branches of an alternation inside a loop can match the same input. */
	AMBIGUOUS_ALTERNATION = 'AMBIGUOUS_ALTERNATION',
	/** A loop repeats something that can match nothing, so every position is a choice point. */
	NULLABLE_REPETITION = 'NULLABLE_REPETITION',
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

/**
 * A set of characters, coarsely.
 *
 * Used to ask two questions and no others: whether two alternatives can *begin* with the same
 * character, and whether the text between two repetitions could have been consumed by the first of
 * them. Both are approximations, so the model carries only what those questions need.
 *
 * A negated class is modelled as a complement rather than widened to "any character", and that is
 * load-bearing rather than tidy: `[^@]+@[^@]+` is a perfectly safe pattern whose boundary cannot
 * slide precisely *because* `[^@]` cannot match the `@` between the two repetitions, and a model
 * that read `[^@]` as "any character" would refuse it.
 */
interface ICharSet {
	/** True when the set is everything *except* {@link ranges}. */
	complement: boolean;

	/** Inclusive code-point ranges: the set, or — for a complement — what it excludes. */
	ranges: Array<[number, number]>;
}

/** The set that admits every character, and the stand-in for anything this model cannot enumerate. */
const ANY_CHARACTER: ICharSet = { complement: true, ranges: [] };

/**
 * @returns A fresh set that admits everything.
 */
function anySet(): ICharSet {
	return { complement: true, ranges: [] };
}

/**
 * @returns A fresh set that admits nothing.
 */
function emptySet(): ICharSet {
	return { complement: false, ranges: [] };
}

/** A node of the parsed pattern. */
type PatternNode =
	| { kind: 'char'; set: ICharSet }
	| { kind: 'anchor' }
	| { kind: 'group'; alternatives: PatternNode[][]; lookaround: boolean }
	| { kind: 'repeat'; body: PatternNode; min: number; max: number };

/** Raised by the parser; carried out through {@link analyzePattern} as a verdict. */
class PatternRefusal extends Error {
	constructor(readonly reason: PatternRejection, readonly detail: string) {
		super(detail);
	}
}

/**
 * Decides whether a pattern may be compiled and run.
 *
 * @param pattern The pattern as the author wrote it, without the anchors the evaluator adds.
 * @param maxLength The longest pattern accepted.
 * @returns The verdict, and the reason when it refuses.
 */
export function analyzePattern(pattern: string, maxLength: number): IPatternVerdict {
	if (typeof pattern !== 'string' || pattern.length === 0) {
		return { safe: false, reason: PatternRejection.EMPTY, detail: 'A MATCHES pattern cannot be empty.' };
	}

	if (pattern.length > maxLength) {
		return {
			safe: false,
			reason: PatternRejection.TOO_LONG,
			detail: `A MATCHES pattern is at most ${maxLength} characters; this one is ${pattern.length}.`
		};
	}

	let parsed: { alternatives: PatternNode[][]; counters: IParseCounters };

	try {
		parsed = parsePattern(pattern);
	} catch (error) {
		if (error instanceof PatternRefusal) {
			return { safe: false, reason: error.reason, detail: error.detail };
		}

		return {
			safe: false,
			reason: PatternRejection.SYNTAX,
			detail: 'The MATCHES pattern could not be read as a regular expression.'
		};
	}

	const capped = checkCounters(parsed.counters);

	if (capped) {
		return capped;
	}

	try {
		// The tree is walked with the pattern's own alternatives treated as a top-level alternation
		// that is not inside a loop, which is exactly what the anchored form the evaluator compiles
		// makes it.
		for (const alternative of parsed.alternatives) {
			walkSequence(alternative, false);
		}
	} catch (error) {
		if (error instanceof PatternRefusal) {
			return { safe: false, reason: error.reason, detail: error.detail };
		}

		throw error;
	}

	try {
		// The last word belongs to the engine that will run it: a pattern this analysis accepts but
		// JavaScript refuses to compile is still a pattern the evaluator cannot use, and it is a
		// syntax mistake the author should be told about here rather than at evaluation time.
		new RegExp(`^(?:${pattern})$`);
	} catch {
		return {
			safe: false,
			reason: PatternRejection.SYNTAX,
			detail: 'The MATCHES pattern is not a regular expression JavaScript can compile.'
		};
	}

	return { safe: true };
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
 * @param counters What the parser counted.
 * @returns The refusal when a cap was exceeded, or undefined.
 */
function checkCounters(counters: IParseCounters): IPatternVerdict | undefined {
	const exceeded: Array<[string, number, number]> = [
		['nodes', counters.nodes, RULE_MAX_PATTERN_NODES],
		['repeating quantifiers', counters.loops, RULE_MAX_PATTERN_LOOPS],
		['groups', counters.groups, RULE_MAX_PATTERN_GROUPS],
		['alternation branches', counters.alternatives, RULE_MAX_PATTERN_ALTERNATIVES],
		['nesting depth', counters.depth, RULE_MAX_PATTERN_DEPTH]
	];

	for (const [what, value, cap] of exceeded) {
		if (value > cap) {
			return {
				safe: false,
				reason: PatternRejection.TOO_COMPLEX,
				detail: `A MATCHES pattern declares at most ${cap} ${what}; this one declares ${value}.`
			};
		}
	}

	return undefined;
}

/**
 * Reads a pattern into a tree.
 *
 * A recursive-descent reader over the subset of JavaScript's syntax a rule pattern may use. It is
 * written here rather than taken from a dependency because what it has to be is *conservative*: an
 * unrecognised construct has to become the widest thing it could be, so that the checks above it
 * refuse rather than admit. A general parser optimises for describing a pattern exactly, which is a
 * different goal and fails in the opposite direction.
 *
 * @param pattern The pattern text.
 * @returns The top-level alternatives and what was counted while reading them.
 * @throws PatternRefusal when the pattern uses a construct the platform refuses.
 */
function parsePattern(pattern: string): { alternatives: PatternNode[][]; counters: IParseCounters } {
	const counters: IParseCounters = { nodes: 0, loops: 0, groups: 0, alternatives: 0, depth: 0 };
	let index = 0;

	/**
	 * @returns The character at the cursor, or the empty string at the end.
	 */
	const peek = (): string => pattern[index] ?? '';

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

			if (pattern.startsWith('?:', index)) {
				index += 2;
			} else if (pattern.startsWith('?=', index) || pattern.startsWith('?!', index)) {
				index += 2;
				lookaround = true;
			} else if (pattern.startsWith('?<=', index) || pattern.startsWith('?<!', index)) {
				index += 3;
				lookaround = true;
			} else if (pattern.startsWith('?<', index)) {
				// A named capture group. The name is read and discarded; what matters is the body.
				const close = pattern.indexOf('>', index);

				if (close < 0) {
					throw new PatternRefusal(
						PatternRejection.SYNTAX,
						'The MATCHES pattern has a named group whose name is not closed.'
					);
				}

				index = close + 1;
			}

			const alternatives = readAlternation(depth + 1);

			if (peek() !== ')') {
				throw new PatternRefusal(
					PatternRejection.SYNTAX,
					'The MATCHES pattern has a group that is never closed.'
				);
			}

			index += 1;

			return { kind: 'group', alternatives, lookaround };
		}

		if (character === ')') {
			throw new PatternRefusal(PatternRejection.SYNTAX, 'The MATCHES pattern closes a group it never opened.');
		}

		if (character === '[') {
			return { kind: 'char', set: readCharacterClass() };
		}

		if (character === '^' || character === '$') {
			index += 1;
			return { kind: 'anchor' };
		}

		if (character === '.') {
			index += 1;
			return { kind: 'char', set: anySet() };
		}

		if (character === '*' || character === '+' || character === '?') {
			throw new PatternRefusal(
				PatternRejection.SYNTAX,
				`The MATCHES pattern applies "${character}" to nothing.`
			);
		}

		if (character === '\\') {
			const set = readEscapeSequence(false);

			return set === null ? { kind: 'anchor' } : { kind: 'char', set };
		}

		index += 1;

		return { kind: 'char', set: singleton(character) };
	};

	/**
	 * Reads one escape sequence and advances past everything it spans.
	 *
	 * The trailing digits of `\xNN`, `\uNNNN`, `\u{...}` and `\p{...}` are consumed here rather than
	 * left to be read as literals, because leaving them behind would change what the *next* atom is —
	 * and a quantifier that ended up applying to a stray hex digit would be counted in the wrong
	 * scope, which is the one direction this reader must never fail in.
	 *
	 * @param inClass Whether the escape sits inside a `[...]`, where `b` is a backspace rather than a
	 * word boundary and where an anchor cannot appear.
	 * @returns The characters the escape admits, or null when it is a zero-width assertion.
	 */
	const readEscapeSequence = (inClass: boolean): ICharSet | null => {
		index += 1;

		const escaped = pattern[index];

		if (escaped === undefined) {
			throw new PatternRefusal(PatternRejection.SYNTAX, 'The MATCHES pattern ends in a backslash.');
		}

		if (!inClass && (/[1-9]/.test(escaped) || escaped === 'k')) {
			// A backreference makes the cost of a match depend on what the input happened to capture,
			// which is the one shape no structural analysis can bound.
			throw new PatternRefusal(
				PatternRejection.BACKREFERENCE,
				'A MATCHES pattern cannot use a backreference; its cost depends on the input it is matched against.'
			);
		}

		index += 1;

		if (!inClass && (escaped === 'b' || escaped === 'B')) {
			return null;
		}

		if (escaped === 'x') {
			skipWhile(/[0-9a-fA-F]/, 2);
			return anySet();
		}

		if (escaped === 'u' || escaped === 'p' || escaped === 'P') {
			if (peek() === '{') {
				const close = pattern.indexOf('}', index);

				index = close < 0 ? pattern.length : close + 1;
			} else if (escaped === 'u') {
				skipWhile(/[0-9a-fA-F]/, 4);
			}

			return anySet();
		}

		if (escaped === 'c') {
			skipWhile(/[a-zA-Z]/, 1);
			return anySet();
		}

		return escapeSet(escaped);
	};

	/**
	 * Advances the cursor over up to `count` characters matching `accepted`.
	 *
	 * @param accepted What may be skipped.
	 * @param count How many at most.
	 */
	const skipWhile = (accepted: RegExp, count: number): void => {
		for (let step = 0; step < count && index < pattern.length && accepted.test(pattern[index]); step += 1) {
			index += 1;
		}
	};

	/**
	 * Reads a `[...]` class and answers the characters it admits.
	 *
	 * A negated class is answered as the complement of what it lists rather than as "any character",
	 * because the difference decides whether a pattern such as `[^@]+@[^@]+` is refused: its boundary
	 * cannot slide exactly because `[^@]` excludes the separator, and a model that forgot the
	 * exclusion would call it ambiguous.
	 *
	 * A member the reader cannot enumerate — a `\D` inside the brackets, a Unicode property — makes
	 * the whole class "any character", which is the reading that refuses rather than admits.
	 *
	 * @returns The set.
	 */
	const readCharacterClass = (): ICharSet => {
		index += 1;

		const negated = peek() === '^';

		if (negated) {
			index += 1;
		}

		const ranges: Array<[number, number]> = [];
		let unreadable = false;
		let closed = false;

		while (index < pattern.length) {
			if (peek() === ']') {
				index += 1;
				closed = true;
				break;
			}

			let low: ICharSet;

			if (peek() === '\\') {
				low = readEscapeSequence(true) ?? anySet();
			} else {
				low = singleton(pattern[index]);
				index += 1;
			}

			// A range: the member just read, a dash, and a member that is not the closing bracket.
			if (peek() === '-' && pattern[index + 1] !== undefined && pattern[index + 1] !== ']') {
				index += 1;

				let high: ICharSet;

				if (peek() === '\\') {
					high = readEscapeSequence(true) ?? anySet();
				} else {
					high = singleton(pattern[index]);
					index += 1;
				}

				const from = low.ranges[0]?.[0];
				const to = high.ranges[0]?.[1];

				if (low.complement || high.complement || from === undefined || to === undefined) {
					unreadable = true;
				} else {
					ranges.push([Math.min(from, to), Math.max(from, to)]);
				}

				continue;
			}

			if (low.complement) {
				unreadable = true;
			} else {
				ranges.push(...low.ranges);
			}
		}

		if (!closed) {
			throw new PatternRefusal(
				PatternRejection.SYNTAX,
				'The MATCHES pattern has a character class that is never closed.'
			);
		}

		return unreadable ? anySet() : { complement: negated, ranges };
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
				// `{` that is not a quantifier is an ordinary literal in JavaScript, and the atom it
				// follows keeps its own shape.
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

		if (Number.isFinite(max) && max > RULE_MAX_PATTERN_REPETITION) {
			throw new PatternRefusal(
				PatternRejection.TOO_COMPLEX,
				`A MATCHES pattern repeats at most ${RULE_MAX_PATTERN_REPETITION} times; this one states ${max}.`
			);
		}

		if (min > max) {
			throw new PatternRefusal(
				PatternRejection.SYNTAX,
				'The MATCHES pattern states a repetition whose bounds are reversed.'
			);
		}

		if (isLoop({ min, max, body: atom })) {
			counters.loops += 1;
		}

		counters.nodes += 1;

		return { kind: 'repeat', body: atom, min, max };
	};

	/**
	 * Reads a `{n}`, `{n,}` or `{n,m}` quantifier.
	 *
	 * @returns The bounds, or undefined when the brace is an ordinary literal.
	 */
	const readBraceQuantifier = (): { min: number; max: number } | undefined => {
		const close = pattern.indexOf('}', index);

		if (close < 0) {
			return undefined;
		}

		const body = pattern.slice(index + 1, close);

		if (!/^\d+(,\d*)?$/.test(body)) {
			return undefined;
		}

		index = close + 1;

		const [low, high] = body.split(',');
		const min = Number(low);

		if (high === undefined) {
			return { min, max: min };
		}

		return { min, max: high === '' ? Number.POSITIVE_INFINITY : Number(high) };
	};

	const alternatives = readAlternation(0);

	if (index < pattern.length) {
		throw new PatternRefusal(PatternRejection.SYNTAX, 'The MATCHES pattern closes a group it never opened.');
	}

	return { alternatives, counters };
}

/**
 * Whether a repetition is a loop rather than an unrolling.
 *
 * `{3}` repeats exactly three times: the engine has no choice about how many times to go round, and
 * `x{3}` is simply `xxx`. Treating it as a loop would refuse ordinary patterns like
 * `(?:[A-Z]{2}-\d{4},)+`, which is linear and legitimate.
 *
 * **Unless what it repeats already contains a choice.** `(?:.*a){20}` has no variable quantifier on
 * the outside, and yet it is twenty nested `.*`s: each copy may end anywhere, and the ways of
 * splitting one subject between twenty of them is the same explosion a nested loop produces. An
 * exact repetition of something deterministic is an unrolling; an exact repetition of something that
 * chooses is a loop, and this is where the two are told apart.
 *
 * @param node The repetition.
 * @returns True when the repetition multiplies the engine's choices.
 */
function isLoop(node: { min: number; max: number; body?: PatternNode }): boolean {
	if (node.min !== node.max) {
		return true;
	}

	return node.max > 1 && !!node.body && hasChoice(node.body);
}

/**
 * @param node The node to inspect.
 * @returns True when matching the node involves a choice the engine may have to revisit — a variable
 * repetition, or an alternation with more than one branch, at any depth inside it.
 */
function hasChoice(node: PatternNode): boolean {
	switch (node.kind) {
		case 'char':
		case 'anchor':
			return false;
		case 'group':
			return node.alternatives.length > 1 || node.alternatives.some((branch) => branch.some(hasChoice));
		case 'repeat':
			return node.min !== node.max || hasChoice(node.body);
		default:
			return true;
	}
}

/**
 * Walks a branch, refusing what cannot be bounded.
 *
 * @param nodes The branch.
 * @param insideLoop Whether the branch sits inside a repeating quantifier's scope.
 * @throws PatternRefusal when the branch holds a nested loop, an ambiguous alternation inside a loop,
 * a loop over something that can match nothing, or two repetitions whose boundary can slide.
 */
function walkSequence(nodes: PatternNode[], insideLoop: boolean): void {
	assertUnambiguousRepetitions(nodes);

	for (const node of nodes) {
		walkNode(node, insideLoop);
	}
}

/**
 * Refuses two repetitions in one sequence whose boundary can slide.
 *
 * `a*a*b` is the smallest example and `.*a.*a.*a.*b` is the one that hurts: neither has a nested
 * loop and neither has an alternation, so the two checks above see nothing, and yet the engine has
 * to try every way of dividing the subject between the repetitions. That is a polynomial of degree
 * *k* for *k* sliding repetitions, and degree grows out of hand fast: over the
 * {@link RULE_MAX_MATCH_INPUT}-character subject the platform allows, two of them is a quarter of a
 * million steps and four of them is sixty-eight billion.
 *
 * **Two are therefore allowed and three are not**, which is a deliberate line rather than a round
 * number. Two is the shape of half the regular expressions anybody writes — the standard email
 * pattern is `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`, whose last two repetitions genuinely
 * slide against each other across the dot — and quadratic over a bounded subject is work, not a
 * denial of service. Three is where the curve stops being work.
 *
 * The boundary between two repetitions can slide only when both can consume the same character *and*
 * everything between them could have been consumed by the first. That second condition is what keeps
 * `[a-z]+@[a-z]+` — where the `@` separates the two and neither repetition can match it — and
 * `[^@]+@[^@]+`, whose repetitions explicitly exclude their own separator.
 *
 * @param nodes The sequence.
 * @throws PatternRefusal when three or more repetitions in the sequence can divide one subject
 * between them.
 */
function assertUnambiguousRepetitions(nodes: PatternNode[]): void {
	const repeating = nodes
		.map((node, position) => ({ position, set: variableSet(node) }))
		.filter((entry): entry is { position: number; set: ICharSet } => entry.set !== null);

	const sliding = new Set<number>();

	for (let left = 0; left < repeating.length; left += 1) {
		for (let right = left + 1; right < repeating.length; right += 1) {
			if (!intersects(repeating[left].set, repeating[right].set)) {
				continue;
			}

			const between = nodes.slice(repeating[left].position + 1, repeating[right].position);
			const separated = between.some(
				(node) => !isNullable(node) && !containedIn(firstSetOfNode(node), repeating[left].set)
			);

			if (!separated) {
				sliding.add(left);
				sliding.add(right);
			}
		}
	}

	if (sliding.size > MAX_SLIDING_REPETITIONS) {
		throw new PatternRefusal(
			PatternRejection.AMBIGUOUS_ALTERNATION,
			`A MATCHES pattern holds at most ${MAX_SLIDING_REPETITIONS} repetitions that can consume the same text with nothing between them to fix the boundary; this one holds ${sliding.size}, and the engine has to try every way of dividing the subject between them.`
		);
	}
}

/**
 * How many repetitions in one sequence may share a sliding boundary.
 *
 * Each one adds a degree to the polynomial the engine walks; see
 * {@link assertUnambiguousRepetitions} for why two is work and three is not.
 */
const MAX_SLIDING_REPETITIONS = 2;

/**
 * The characters a node can consume a variable number of.
 *
 * @param node The node.
 * @returns The set, or null when the node consumes a fixed amount and therefore cannot slide.
 */
function variableSet(node: PatternNode): ICharSet | null {
	switch (node.kind) {
		case 'char':
		case 'anchor':
			return null;
		case 'group': {
			if (node.lookaround) {
				// A lookaround consumes nothing, so there is no boundary between it and what follows
				// for anything to slide across. Its own body is walked like any other sequence.
				return null;
			}

			// A group is not itself a repetition, but it may wrap one — `(?:a*)b*` is `a*b*` with a
			// pair of brackets, and the pair still slides.
			const set = emptySet();
			let found = false;

			for (const alternative of node.alternatives) {
				for (const inner of alternative) {
					const innerSet = variableSet(inner);

					if (innerSet) {
						found = true;
						union(set, innerSet);
					}
				}
			}

			return found ? set : null;
		}
		case 'repeat':
			return node.min !== node.max ? firstSetOfNode(node.body) : variableSet(node.body);
		default:
			return anySet();
	}
}

/**
 * Walks one node.
 *
 * @param node The node.
 * @param insideLoop Whether the node sits inside a repeating quantifier's scope.
 * @throws PatternRefusal as {@link walkSequence} does.
 */
function walkNode(node: PatternNode, insideLoop: boolean): void {
	switch (node.kind) {
		case 'char':
		case 'anchor':
			return;

		case 'group':
			if (insideLoop && node.alternatives.length > 1) {
				assertUnambiguousAlternation(node.alternatives);
			}

			for (const alternative of node.alternatives) {
				walkSequence(alternative, insideLoop);
			}

			return;

		case 'repeat': {
			const loop = isLoop(node);

			if (loop && insideLoop) {
				// Star height two. `((a)*)*`, `(a+)+`, `(?:a?)*` and every relative of theirs land here:
				// the engine may choose how many times to go round the inner loop *and* the outer one,
				// and the number of ways to split one input between them grows exponentially.
				throw new PatternRefusal(
					PatternRejection.STAR_HEIGHT,
					'A MATCHES pattern cannot repeat something that itself repeats: the two choices multiply, and the match can take exponential time.'
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

			walkNode(node.body, insideLoop || loop);

			return;
		}

		default:
			return;
	}
}

/**
 * Refuses an alternation inside a loop whose branches can match the same input.
 *
 * The test is on the characters each branch can *begin* with, and it is a prefix test rather than a
 * language-intersection test — see the file comment for what that misses. Two branches that share a
 * possible first character are refused, and so is a branch that can match nothing, because an empty
 * branch overlaps with every other one at every position.
 *
 * @param alternatives The branches.
 * @throws PatternRefusal when two branches overlap.
 */
function assertUnambiguousAlternation(alternatives: PatternNode[][]): void {
	const firsts = alternatives.map((alternative) => firstSet(alternative));

	for (let left = 0; left < alternatives.length; left += 1) {
		if (alternatives[left].every((node) => isNullable(node))) {
			throw new PatternRefusal(
				PatternRejection.AMBIGUOUS_ALTERNATION,
				'A MATCHES pattern cannot repeat an alternation one of whose branches matches nothing.'
			);
		}

		for (let right = left + 1; right < alternatives.length; right += 1) {
			if (intersects(firsts[left], firsts[right])) {
				throw new PatternRefusal(
					PatternRejection.AMBIGUOUS_ALTERNATION,
					'A MATCHES pattern cannot repeat an alternation whose branches can match the same text: the engine has to try both at every position, and the attempts multiply.'
				);
			}
		}
	}
}

/**
 * @param node The node.
 * @returns True when the node can match the empty string.
 */
function isNullable(node: PatternNode): boolean {
	switch (node.kind) {
		case 'char':
			return false;
		case 'anchor':
			return true;
		case 'group':
			// A lookaround consumes nothing, so it always matches empty.
			return node.lookaround || node.alternatives.some((alternative) => alternative.every(isNullable));
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
function firstSet(nodes: PatternNode[]): ICharSet {
	const result: ICharSet = emptySet();

	for (const node of nodes) {
		union(result, firstSetOfNode(node));

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
		case 'anchor':
			return emptySet();
		case 'group': {
			if (node.lookaround) {
				// A lookaround constrains what follows without consuming it. Treating it as matching
				// nothing keeps the walk moving to the node that does consume.
				return emptySet();
			}

			const set: ICharSet = emptySet();

			for (const alternative of node.alternatives) {
				union(set, firstSet(alternative));
			}

			return set;
		}
		case 'repeat':
			return firstSetOfNode(node.body);
		default:
			return anySet();
	}
}

/**
 * Merges one set into another, in place.
 *
 * A union involving a complement is widened to "every character" rather than computed exactly. That
 * is the one deliberate imprecision in the model: the exact algebra is a page of range arithmetic
 * whose only customer would be a pattern that unions a negated class with something else at the same
 * position, and the widening errs towards refusing.
 *
 * @param into The set to widen.
 * @param from The set to merge in.
 */
function union(into: ICharSet, from: ICharSet): void {
	if (into.complement || from.complement) {
		into.complement = true;
		into.ranges.length = 0;

		return;
	}

	into.ranges.push(...from.ranges);
}

/**
 * @param left One set.
 * @param right Another set.
 * @returns True when a character exists that both sets admit.
 */
function intersects(left: ICharSet, right: ICharSet): boolean {
	if (left.complement && right.complement) {
		// Two complements both admit everything outside the union of what they exclude, and that is
		// never empty for the finite exclusions a pattern can state.
		return true;
	}

	if (left.complement) {
		return right.ranges.some((range) => !containsRange(left.ranges, range));
	}

	if (right.complement) {
		return left.ranges.some((range) => !containsRange(right.ranges, range));
	}

	for (const [leftLow, leftHigh] of left.ranges) {
		for (const [rightLow, rightHigh] of right.ranges) {
			if (leftLow <= rightHigh && rightLow <= leftHigh) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Whether everything one set admits, another admits too.
 *
 * @param inner The narrower set.
 * @param outer The wider set.
 * @returns True when `outer` admits every character `inner` does.
 */
function containedIn(inner: ICharSet, outer: ICharSet): boolean {
	if (outer.complement) {
		// "Everything except X" contains `inner` when `inner` admits none of X. A complement inside a
		// complement is only contained when the outer excludes no more than the inner does.
		return inner.complement
			? outer.ranges.every((range) => containsRange(inner.ranges, range))
			: inner.ranges.every((range) => !overlapsRange(outer.ranges, range));
	}

	if (inner.complement) {
		return false;
	}

	return inner.ranges.every((range) => containsRange(outer.ranges, range));
}

/**
 * @param ranges The ranges to look in.
 * @param range The range to look for.
 * @returns True when one of `ranges` covers the whole of `range`.
 */
function containsRange(ranges: Array<[number, number]>, range: [number, number]): boolean {
	return ranges.some(([low, high]) => low <= range[0] && range[1] <= high);
}

/**
 * @param ranges The ranges to look in.
 * @param range The range to look for.
 * @returns True when one of `ranges` shares a character with `range`.
 */
function overlapsRange(ranges: Array<[number, number]>, range: [number, number]): boolean {
	return ranges.some(([low, high]) => low <= range[1] && range[0] <= high);
}

/**
 * @param character A single character.
 * @returns The set holding exactly it.
 */
function singleton(character: string): ICharSet {
	const code = character?.codePointAt(0);

	return code === undefined ? anySet() : { complement: false, ranges: [[code, code]] };
}

/**
 * The characters an escape sequence admits.
 *
 * The enumerable classes are enumerated; everything else — a negated class, a Unicode property, an
 * escape this reader does not know — becomes "any character", so that the ambiguity test refuses
 * rather than admits.
 *
 * @param escaped The character after the backslash.
 * @returns The set.
 */
function escapeSet(escaped: string): ICharSet {
	switch (escaped) {
		case 'd':
			return { complement: false, ranges: [[48, 57]] };
		case 'w':
			return {
				complement: false,
				ranges: [
					[48, 57],
					[65, 90],
					[95, 95],
					[97, 122]
				]
			};
		case 's':
			return {
				complement: false,
				ranges: [
					[9, 13],
					[32, 32],
					[160, 160],
					[8192, 8233],
					[65279, 65279]
				]
			};
		case 'D':
			return { complement: true, ranges: [[48, 57]] };
		case 'W':
			return {
				complement: true,
				ranges: [
					[48, 57],
					[65, 90],
					[95, 95],
					[97, 122]
				]
			};
		case 'S':
			return {
				complement: true,
				ranges: [
					[9, 13],
					[32, 32],
					[160, 160],
					[8192, 8233],
					[65279, 65279]
				]
			};
		case 'p':
		case 'P':
			return anySet();
		case 'b':
			// Only reachable inside a character class, where `\b` is a backspace rather than the word
			// boundary it is everywhere else. The distinction is not worth modelling, and "any" is the
			// reading that refuses rather than admits.
			return anySet();
		case 'n':
			return singleton('\n');
		case 'r':
			return singleton('\r');
		case 't':
			return singleton('\t');
		case 'f':
			return singleton('\f');
		case 'v':
			return singleton('\v');
		case '0':
			return singleton('\0');
		case 'x':
		case 'u':
			// The digits that follow are not read: what matters here is that the escape denotes one
			// character whose identity this model does not need to know precisely, and "any" is the
			// conservative stand-in for it.
			return anySet();
		default:
			return singleton(escaped);
	}
}
