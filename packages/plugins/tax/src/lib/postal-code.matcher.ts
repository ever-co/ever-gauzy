import { BadRequestException, Logger } from '@nestjs/common';
import { PatternSafetyOptions, describePattern, isSafePattern } from '@gauzy/core';

/**
 * The one place that decides what a stored postal-code pattern means.
 *
 * A rate and a regime both narrow their zone with a pattern, and both used to compile it themselves —
 * `new RegExp(pattern, 'i')` followed by `.test(postalCode)` — which had two defects that a tax
 * jurisdiction cannot afford.
 *
 * **It was unanchored.** `test` asks whether the pattern occurs *somewhere* in the code, so a rate
 * configured for `90210` also claimed the destination `190210`, and the wrong jurisdiction's rate was
 * charged on a real order. The rule kernel already decided the other way — `compilePattern` anchors
 * with `^(?:…)$` — so the two halves of the platform disagreed about what "matches" meant. They agree
 * here: a pattern states what the whole code is, not what part of it contains.
 *
 * **And it was unbounded.** The postal code is request input (`resolve-tax-rate.dto.ts`,
 * `tax-calculation.dto.ts`, and the GraphQL inputs, which carry no length bound of their own), and the
 * pattern was accepted on write after nothing more than a compilability check — so `(a+)+b` was
 * storable, and one resolve request carrying a string of `a`s sent the regex engine into exponential
 * backtracking on the single event loop, stalling every other request in the process.
 *
 * Patterns are screened by the kernel's regex analyser, `isSafePattern` — the one the rule engine's
 * `MATCHES` operator uses. It parses the pattern and refuses the shapes whose backtracking can grow
 * faster than the subject does (a choice inside a loop, overlapping alternatives, three repetitions
 * sliding against each other, a backreference, a modifier group) along with anything past the
 * kernel's structural bounds; its own file comment states what it checks and what it cannot. The
 * pattern is screened **twice**, with the same options both times:
 *
 * - on write, by {@link assertPostalCodePattern}, so an author is told why a pattern was refused;
 * - and again here, before it is compiled, because the write path is not the only way a row gets into
 *   the table. A seed, an import, a migration, a restore from a backup taken before the analysis
 *   existed, or any writer that does not route through the two services stores a pattern nobody
 *   screened, and the cache below then guaranteed the hostile pattern was reused on every resolution
 *   rather than recompiled. A refused pattern makes its row not match — the same answer a pattern that
 *   does not compile already gave — and is logged once, when its verdict is cached.
 *
 * The code it is matched against is bounded too, by {@link MAX_POSTAL_CODE_LENGTH}. That is the bound
 * that does not depend on the analysis being complete: whatever the analysis accepts is at worst
 * polynomial in the subject's length, and the length is then a constant.
 *
 * Compiled expressions are cached by pattern text, because the resolution loop tests one destination
 * against every candidate rate of a category and rebuilding the expression per candidate is work with
 * no result. The verdict is cached with them, so the analysis runs once per distinct pattern rather
 * than once per candidate.
 */

/** How many compiled expressions are kept before the cache is cleared. */
const MAX_COMPILED_PATTERNS = 500;

/**
 * The longest postal code a pattern is ever matched against.
 *
 * The same bound the REST inputs state with `@MaxLength(32)`; the GraphQL inputs state none, so this is
 * the bound both surfaces share. No postal system writes a code anywhere near it — a US ZIP+4 with its
 * hyphen is ten characters — so a longer one is not a postal code, and it matches no pattern.
 */
export const MAX_POSTAL_CODE_LENGTH = 32;

/**
 * How the matcher compiles a pattern — anchored, and with `i` — stated once so that the write path and
 * the matcher analyse a pattern the same way and cannot reach different verdicts. `(?:a|A)+` is safe
 * without `i` and ambiguous with it, which is why the flag is part of the question.
 */
const POSTAL_PATTERN_OPTIONS: Readonly<PatternSafetyOptions> = Object.freeze({ caseInsensitive: true });

/** The compiled expressions, keyed by the pattern text as it is stored. */
const compiledPatterns = new Map<string, RegExp | null>();

/**
 * Where a refused stored pattern is reported. Nest's logger works outside Nest too, which is what a
 * seed script and a migration need of it.
 */
const logger = new Logger('PostalCodeMatcher');

/**
 * @param pattern The pattern as the column holds it.
 * @returns The anchored, case-insensitive expression, or null when the analysis refuses the pattern or
 * it does not compile. Either way the row does not match rather than failing a tax calculation halfway
 * through, or stalling it: the write path is where a bad pattern is refused with a reason, and this is
 * where one that arrived some other way is kept from running.
 */
function compilePostalPattern(pattern: string): RegExp | null {
	const cached = compiledPatterns.get(pattern);

	if (cached !== undefined) {
		return cached;
	}

	let compiled: RegExp | null = null;
	const verdict = describePattern(pattern, POSTAL_PATTERN_OPTIONS);

	if (verdict.safe) {
		try {
			// Anchored, and with `i` — which is what `POSTAL_PATTERN_OPTIONS` tells the analysis.
			compiled = new RegExp(`^(?:${pattern})$`, 'i');
		} catch {
			compiled = null;
		}
	} else {
		// The pattern text is quoted, and cut short, because it is author-controlled and may be long.
		logger.warn(
			`A postal code pattern matches no postal code until it is rewritten: the pattern ${JSON.stringify(
				pattern.slice(0, 64)
			)}${pattern.length > 64 ? '…' : ''} was refused (${verdict.reason}). ${verdict.detail ?? ''}`.trim()
		);
	}

	if (compiledPatterns.size >= MAX_COMPILED_PATTERNS) {
		compiledPatterns.clear();
	}

	compiledPatterns.set(pattern, compiled);

	return compiled;
}

/**
 * @param pattern The row's postal pattern.
 * @param postalCode The destination's postal code.
 * @returns Whether the pattern is the whole of the code, case-insensitively and with the spacing of
 * the code ignored, because the same Canadian or British code is written with and without its space.
 * False for a code longer than {@link MAX_POSTAL_CODE_LENGTH}, which is not run at all.
 */
export function matchesPostalCode(pattern: string, postalCode?: string): boolean {
	if (!postalCode) {
		return false;
	}

	// Checked before the pattern is compiled or the code is compacted, so an oversized code costs
	// nothing but this comparison.
	if (postalCode.length > MAX_POSTAL_CODE_LENGTH) {
		return false;
	}

	const expression = compilePostalPattern(pattern);

	if (!expression) {
		return false;
	}

	const compact = postalCode.replace(/\s+/g, '');

	return expression.test(postalCode) || expression.test(compact);
}

/**
 * @param pattern The postal pattern, when the caller supplied one.
 * @param subject What the pattern is being written on, for the message.
 * @throws BadRequestException when it does not compile as a pattern, or when it is one whose cost
 * depends on the input it is matched against. A pattern is what the column holds: a comma-separated
 * list of postal codes is a list, and a list would need a table of its own.
 */
export function assertPostalCodePattern(pattern?: string, subject = 'tax rate'): void {
	if (!pattern) {
		return;
	}

	if (!isSafePattern(pattern, POSTAL_PATTERN_OPTIONS)) {
		throw new BadRequestException(
			`The postal code pattern "${pattern}" cannot be used on a ${subject}: it is not a valid pattern, it is ` +
				`longer than a postal pattern may be, or it can backtrack without bound against a postal code a ` +
				`caller supplies.`
		);
	}

	// The analysis has compiled the pattern already, with the options the matcher compiles it with.
	// Compiling it through the matcher as well keeps the two in step if the matcher's flags ever change
	// without `POSTAL_PATTERN_OPTIONS` following them.
	if (!compilePostalPattern(pattern)) {
		throw new BadRequestException(`The postal code pattern "${pattern}" is not a valid pattern.`);
	}
}
