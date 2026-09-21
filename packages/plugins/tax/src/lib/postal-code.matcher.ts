import { BadRequestException } from '@nestjs/common';
import { isSafePattern } from '@gauzy/core';

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
 * `tax-calculation.dto.ts`), and the pattern was accepted on write after nothing more than a
 * compilability check — so `(a+)+b` was storable, and one resolve request carrying a string of `a`s
 * sent the regex engine into exponential backtracking on the single event loop, stalling every other
 * request in the process. Patterns are now screened on write with the kernel's own `isSafePattern`,
 * which refuses a backreference, a quantified group under a quantifier and anything past the kernel's
 * length bound.
 *
 * Compiled expressions are cached by pattern text, because the resolution loop tests one destination
 * against every candidate rate of a category and rebuilding the expression per candidate is work with
 * no result.
 */

/** How many compiled expressions are kept before the cache is cleared. */
const MAX_COMPILED_PATTERNS = 500;

/** The compiled expressions, keyed by the pattern text as it is stored. */
const compiledPatterns = new Map<string, RegExp | null>();

/**
 * @param pattern The pattern as the column holds it.
 * @returns The anchored, case-insensitive expression, or null when the pattern does not compile. A
 * stored pattern that does not compile makes its row not match rather than failing a tax calculation
 * halfway through: the write path is where a bad pattern is refused.
 */
function compilePostalPattern(pattern: string): RegExp | null {
	const cached = compiledPatterns.get(pattern);

	if (cached !== undefined) {
		return cached;
	}

	let compiled: RegExp | null = null;

	try {
		compiled = new RegExp(`^(?:${pattern})$`, 'i');
	} catch {
		compiled = null;
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
 */
export function matchesPostalCode(pattern: string, postalCode?: string): boolean {
	if (!postalCode) {
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

	if (!isSafePattern(pattern)) {
		throw new BadRequestException(
			`The postal code pattern "${pattern}" cannot be used on a ${subject}: it is not a valid pattern, it is ` +
				`longer than a postal pattern may be, or it can backtrack without bound against a postal code a ` +
				`caller supplies.`
		);
	}

	// `isSafePattern` compiles the anchored form without flags; the matcher compiles it with `i`, and a
	// pattern that compiles one way compiles the other. Compiling here as well keeps the two in step if
	// the matcher's flags ever change.
	if (!compilePostalPattern(pattern)) {
		throw new BadRequestException(`The postal code pattern "${pattern}" is not a valid pattern.`);
	}
}
