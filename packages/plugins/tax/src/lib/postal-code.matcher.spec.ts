import { BadRequestException, Logger } from '@nestjs/common';
import { MAX_POSTAL_CODE_LENGTH, assertPostalCodePattern, matchesPostalCode } from './postal-code.matcher';

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
 * A third is the same property on the other path: a stored pattern that never passed the write check
 * is screened again before it runs, and a code longer than any postal code is not matched at all.
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
		// The pattern is now refused by the analysis before it is compiled, and the refusal is logged, so
		// the logger is silenced here and the log itself is asserted by the suite below.
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		try {
			expect(matchesPostalCode('90210', undefined)).toBe(false);
			expect(matchesPostalCode('90210', '')).toBe(false);
			expect(matchesPostalCode('[unterminated', '[unterminated')).toBe(false);
		} finally {
			warn.mockRestore();
		}
	});
});

describe('matchesPostalCode — a stored pattern the write path would have refused', () => {
	// Rows reach the matcher from seeds, imports, migrations, restores and any writer that does not go
	// through the two services, none of which runs `assertPostalCodePattern`. The matcher applies the
	// same analysis itself, so a hostile pattern that got into the table is never run — the gap the
	// rule evaluator had, closed the same way.
	let warn: jest.SpyInstance;
	let runs: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		runs = jest.spyOn(RegExp.prototype, 'test');
	});

	afterEach(() => {
		warn.mockRestore();
		runs.mockRestore();
	});

	/** @returns The compiled patterns the matcher ran, by their source. */
	const patternsRun = (): string[] => runs.mock.contexts.map((context) => (context as RegExp).source);

	it('does not match, and never runs the pattern', () => {
		// `(a|a)+` matches `aaaa`, so before the matcher screened it a rate carrying it claimed that code —
		// and on `aaaa…a!` it backtracked through 2^n attempts on the event loop.
		expect(new RegExp('^(?:(a|a)+)$', 'i').test('aaaa')).toBe(true);
		runs.mockClear();

		expect(matchesPostalCode('(a|a)+', 'aaaa')).toBe(false);
		expect(patternsRun()).not.toContain('^(?:(a|a)+)$');
	});

	it('tells an operator once per pattern, naming the reason', () => {
		matchesPostalCode('((b+))+', 'bbb');
		matchesPostalCode('((b+))+', 'bbbb');
		matchesPostalCode('((b+))+', 'b');

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('STAR_HEIGHT');
		expect(warn.mock.calls[0][0]).toContain('"((b+))+"');
	});

	it('reads the pattern as the matcher compiles it, with the `i` flag', () => {
		// `(?:c|C)+` is ambiguous only under `i` — both branches then match the same character — and the
		// matcher compiles with `i`, so the analysis is told so.
		expect(new RegExp('^(?:(?:c|C)+)$', 'i').test('cCc')).toBe(true);
		runs.mockClear();

		expect(matchesPostalCode('(?:c|C)+', 'cCc')).toBe(false);
		expect(patternsRun()).not.toContain('^(?:(?:c|C)+)$');
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('still runs a pattern the analysis accepts', () => {
		// Control: a screen that refused everything would pass every case above.
		expect(matchesPostalCode('\\d{5}(?:-\\d{4})?', '90210-1234')).toBe(true);
		expect(matchesPostalCode('\\d{5}(?:-\\d{4})?', '90210-12')).toBe(false);
		expect(patternsRun()).toContain('^(?:\\d{5}(?:-\\d{4})?)$');
		expect(warn).not.toHaveBeenCalled();
	});
});

describe('matchesPostalCode — the code is bounded', () => {
	// The code is request input, and the GraphQL inputs carry no length bound of their own. A pattern the
	// analysis accepts can still cost a polynomial in the length of what it is matched against; capping
	// that length is the bound that does not depend on the analysis being complete.
	let runs: jest.SpyInstance;

	beforeEach(() => {
		runs = jest.spyOn(RegExp.prototype, 'test');
	});

	afterEach(() => runs.mockRestore());

	it('matches a code as long as the cap, and runs nothing over one longer than any postal code', () => {
		// The cap is the REST inputs' own `@MaxLength(32)`, so the two surfaces refuse the same codes.
		expect(MAX_POSTAL_CODE_LENGTH).toBe(32);
		const longest = '1'.repeat(MAX_POSTAL_CODE_LENGTH);

		expect(matchesPostalCode('[0-9]+', longest)).toBe(true);
		runs.mockClear();

		expect(matchesPostalCode('[0-9]+', `${longest}1`)).toBe(false);
		expect(runs.mock.contexts.map((context) => (context as RegExp).source)).not.toContain('^(?:[0-9]+)$');
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
