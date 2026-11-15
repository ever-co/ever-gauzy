import {
	generateSavedReportToken,
	hashSavedReportToken,
	isWellFormedSavedReportToken,
	savedReportTokenHashesMatch,
	SAVED_REPORT_TOKEN_PREFIX
} from './saved-report-token';

describe('saved report link tokens', () => {
	it('makes a new, well-formed token each time', () => {
		const first = generateSavedReportToken();
		const second = generateSavedReportToken();

		expect(first.startsWith(SAVED_REPORT_TOKEN_PREFIX)).toBe(true);
		expect(isWellFormedSavedReportToken(first)).toBe(true);
		expect(first).not.toBe(second);
	});

	it('refuses anything that is not shaped like a token, before any lookup', () => {
		const token = generateSavedReportToken();

		expect(isWellFormedSavedReportToken(token.slice(0, -1))).toBe(false);
		expect(isWellFormedSavedReportToken(`${token}x`)).toBe(false);
		expect(isWellFormedSavedReportToken(token.replace(SAVED_REPORT_TOKEN_PREFIX, 'gzp_'))).toBe(false);
		expect(isWellFormedSavedReportToken(`${SAVED_REPORT_TOKEN_PREFIX}${'a'.repeat(42)}'`)).toBe(false);
		expect(isWellFormedSavedReportToken(undefined)).toBe(false);
		expect(isWellFormedSavedReportToken(42)).toBe(false);
	});

	it('stores a digest that differs from the token, and matches the same token only', () => {
		const token = generateSavedReportToken();
		const stored = hashSavedReportToken(token);

		expect(stored).toHaveLength(64);
		expect(stored).not.toContain(token);
		expect(savedReportTokenHashesMatch(stored, hashSavedReportToken(token))).toBe(true);
		expect(savedReportTokenHashesMatch(stored, hashSavedReportToken(generateSavedReportToken()))).toBe(false);
		expect(savedReportTokenHashesMatch(null, hashSavedReportToken(token))).toBe(false);
		expect(savedReportTokenHashesMatch(stored, 'short')).toBe(false);
	});
});
