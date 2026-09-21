import { BadRequestException } from '@nestjs/common';
import { assertPostalCodePattern, matchesPostalCode } from './postal-code.matcher';

/**
 * What a stored postal pattern means, and what may be stored.
 *
 * Two properties are asserted here, both of which the previous implementation got wrong:
 *
 * - a pattern states what the **whole** postal code is, not what part of it contains — the rule kernel
 *   already anchors, and a tax rate that claims a neighbouring jurisdiction's code charges the wrong
 *   tax on a real order;
 * - a pattern whose cost depends on the code it is matched against is refused on write, because the
 *   code is request input and the match runs on the process's only thread.
 *
 * There is no database and no service here: the matcher is a pure function of two strings, which is
 * the level the disagreement lived at.
 */
describe('matchesPostalCode — a pattern is the whole code', () => {
	it('does not match a code that merely contains the pattern', () => {
		// The defect this pins: `new RegExp('90210').test('190210')` is true, so a rate configured for
		// Beverly Hills also claimed a code that is not in it.
		expect(matchesPostalCode('90210', '90210')).toBe(true);
		expect(matchesPostalCode('90210', '190210')).toBe(false);
		expect(matchesPostalCode('90210', '902101')).toBe(false);
		expect(matchesPostalCode('90210', 'X90210Y')).toBe(false);
	});

	it('matches a code with or without its internal space, and ignores case', () => {
		// A Canadian code is written both ways and the same rate has to claim both spellings.
		expect(matchesPostalCode('K1A0B1', 'K1A 0B1')).toBe(true);
		expect(matchesPostalCode('K1A0B1', 'k1a0b1')).toBe(true);
		expect(matchesPostalCode('[A-Z][0-9][A-Z][0-9][A-Z][0-9]', 'K1A 0B1')).toBe(true);
	});

	it('supports a pattern that states alternatives, anchored as a whole', () => {
		// `^(?:…)$` wraps the stored pattern, so an alternation is anchored as one — not just its last
		// branch, which is what `^90210|90211$` would mean if the anchors were written into the pattern.
		expect(matchesPostalCode('90210|90211', '90211')).toBe(true);
		expect(matchesPostalCode('90210|90211', '190211')).toBe(false);
	});

	it('answers false for a missing code and for a pattern that does not compile', () => {
		// A stored pattern that does not compile makes its row not match rather than failing a tax
		// calculation halfway through; the write path is where it is refused.
		expect(matchesPostalCode('90210', undefined)).toBe(false);
		expect(matchesPostalCode('90210', '')).toBe(false);
		expect(matchesPostalCode('[unterminated', '[unterminated')).toBe(false);
	});
});

describe('assertPostalCodePattern — what may be stored', () => {
	it('accepts the ordinary postal patterns', () => {
		expect(() => assertPostalCodePattern('90210')).not.toThrow();
		expect(() => assertPostalCodePattern('[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]')).not.toThrow();
		expect(() => assertPostalCodePattern(undefined)).not.toThrow();
		expect(() => assertPostalCodePattern('')).not.toThrow();
	});

	it('refuses a pattern that does not compile', () => {
		expect(() => assertPostalCodePattern('[unterminated')).toThrow(BadRequestException);
	});

	it('refuses a pattern whose cost depends on the code it is matched against', () => {
		// `(a+)+b` is the classic catastrophic-backtracking shape: it compiles, so the old compilability
		// check accepted it, and one resolve request carrying a string of `a`s stalled the process.
		expect(() => assertPostalCodePattern('(a+)+b')).toThrow(BadRequestException);
		expect(() => assertPostalCodePattern('(\\d*)*x')).toThrow(BadRequestException);
	});

	it('refuses a pattern longer than a postal pattern can reasonably be', () => {
		expect(() => assertPostalCodePattern('9'.repeat(257))).toThrow(BadRequestException);
	});

	it('names what the pattern was being written on', () => {
		expect(() => assertPostalCodePattern('(a+)+b', 'tax regime')).toThrow(/tax regime/);
		expect(() => assertPostalCodePattern('(a+)+b', 'tax rate')).toThrow(/tax rate/);
	});
});
