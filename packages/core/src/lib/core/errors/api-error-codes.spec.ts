import { readFileSync } from 'fs';
import { join } from 'path';
import { API_ERROR_CODES, ApiErrorCode, DEFAULT_CODE_BY_STATUS } from './api-error-codes';

/**
 * The catalogue is a published contract, so it is asserted rather than assumed: a code that is
 * spelled differently in two places, a status that answers with a code nobody catalogued, or a
 * filter that references a code that does not exist are all failures a client would discover
 * instead of this suite.
 */
describe('the error-code catalogue', () => {
	const names = Object.keys(ApiErrorCode);

	it('holds the whole kernel block', () => {
		// The shared-infrastructure codes the plan enumerates; a domain adds its own on top.
		expect(names.length).toBeGreaterThanOrEqual(57);
		expect(names).toEqual(expect.arrayContaining(['VALIDATION_FAILED', 'QUERY_CURSOR_INVALID', 'ENTITY_VERSION_CONFLICT']));
		expect(names).toEqual(
			expect.arrayContaining(['IDEMPOTENCY_KEY_REUSED', 'OPERATION_DEADLINE_EXCEEDED', 'PERMISSION_DENIED'])
		);
		expect(names).toEqual(
			expect.arrayContaining(['GRAPHQL_DEPTH_LIMIT_EXCEEDED', 'SEARCH_INDEX_UNAVAILABLE', 'INTERNAL_ERROR'])
		);
	});

	it('uses the code itself as the key, so one token greps everywhere', () => {
		const mismatched = names.filter((name) => ApiErrorCode[name] !== name);
		expect(mismatched).toEqual([]);
	});

	it('is SCREAMING_SNAKE_CASE throughout', () => {
		expect(names.filter((name) => !/^[A-Z][A-Z0-9_]*$/.test(name))).toEqual([]);
	});

	it('has no duplicate code', () => {
		expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
		expect(API_ERROR_CODES.length).toBe(names.length);
	});

	it('maps every status it answers to a catalogued code', () => {
		for (const code of Object.values(DEFAULT_CODE_BY_STATUS)) {
			expect(names).toContain(code);
		}
	});

	it('only maps real error statuses', () => {
		for (const status of Object.keys(DEFAULT_CODE_BY_STATUS)) {
			expect(status).toMatch(/^[45]\d\d$/);
		}
	});

	it('covers every status this platform emits', () => {
		for (const status of [400, 401, 403, 404, 406, 409, 413, 414, 428, 429, 500, 501, 502, 503, 504]) {
			expect(DEFAULT_CODE_BY_STATUS[status]).toBeDefined();
		}
	});

	it('maps a status to the code its throw sites mean', () => {
		expect(DEFAULT_CODE_BY_STATUS[400]).toBe(ApiErrorCode.VALIDATION_FAILED);
		expect(DEFAULT_CODE_BY_STATUS[401]).toBe(ApiErrorCode.AUTH_REQUIRED);
		expect(DEFAULT_CODE_BY_STATUS[403]).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(DEFAULT_CODE_BY_STATUS[404]).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
		expect(DEFAULT_CODE_BY_STATUS[409]).toBe(ApiErrorCode.CONCURRENT_MODIFICATION);
		expect(DEFAULT_CODE_BY_STATUS[429]).toBe(ApiErrorCode.RATE_LIMITED);
		expect(DEFAULT_CODE_BY_STATUS[500]).toBe(ApiErrorCode.INTERNAL_ERROR);
		expect(DEFAULT_CODE_BY_STATUS[503]).toBe(ApiErrorCode.SERVICE_UNAVAILABLE);
	});

	it('leaves a domain-owned status unmapped rather than guessing', () => {
		// 422 carries a dozen unrelated domain meanings; an exception that means something there
		// brings its own code.
		expect(DEFAULT_CODE_BY_STATUS[422]).toBeUndefined();
	});
});

describe('codes referenced by the error path', () => {
	/**
	 * A code is only stable if the name in the source and the row in the catalogue agree. Reading
	 * the sources is what turns that from a convention into a check: a renamed catalogue entry that
	 * a filter still references by the old name fails here rather than at run time, in the one place
	 * a caller cannot work around.
	 */
	const referencing = [
		{ file: 'api-error-codes.ts', path: __dirname },
		{ file: 'api-exception.ts', path: __dirname },
		{ file: 'api-error-body.ts', path: __dirname },
		{ file: 'api-exception.filter.ts', path: __dirname },
		{ file: 'graphql-exception.filter.ts', path: join(__dirname, '..', '..', 'graphql', 'errors') }
	];

	it('exist in the catalogue', () => {
		const names = Object.keys(ApiErrorCode);
		const referenced: string[] = [];

		for (const source of referencing) {
			const text = readFileSync(join(source.path, source.file), 'utf8');
			for (const match of text.matchAll(/ApiErrorCode\.([A-Z][A-Z0-9_]*)/g)) {
				referenced.push(`${source.file}:${match[1]}`);
			}
		}

		expect(referenced.length).toBeGreaterThan(0);
		expect(referenced.filter((entry) => !names.includes(entry.split(':')[1]))).toEqual([]);
	});
});
