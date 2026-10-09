import { ArgumentMetadata } from '@nestjs/common';
import { omitNullValues, ParseJsonPipe } from './parse-json.pipe';

/**
 * `?data={...}` filter objects reach TypeORM `where` clauses; with the connection now translating
 * `null` into `IS NULL` (GHSA-44pv-34gx-q9p4), the pipe must keep the client's long-standing meaning
 * of a JSON null — "not filtered on this key" — by dropping the key at the ingress.
 */
describe('ParseJsonPipe', () => {
	const meta: ArgumentMetadata = { type: 'query', data: 'data' };

	describe('omitNullValues', () => {
		it('drops null-valued properties at any depth and keeps everything else', () => {
			expect(
				omitNullValues({
					findInput: { organizationId: 'org', employeeId: null, nested: { projectId: null, keep: 0, flag: false } },
					relations: ['a', 'b'],
					name: null,
					page: 1
				})
			).toEqual({
				findInput: { organizationId: 'org', nested: { keep: 0, flag: false } },
				relations: ['a', 'b'],
				page: 1
			});
		});

		it('recurses into arrays without removing elements', () => {
			expect(omitNullValues([{ a: null, b: 1 }, null, 'x'])).toEqual([{ b: 1 }, null, 'x']);
		});

		it('leaves primitives alone', () => {
			expect(omitNullValues('str')).toBe('str');
			expect(omitNullValues(0)).toBe(0);
			expect(omitNullValues(null)).toBeNull();
			expect(omitNullValues(undefined)).toBeUndefined();
		});

		it('cannot be used to pollute Object.prototype', () => {
			const parsed = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"ok":1}');
			const out = omitNullValues(parsed) as Record<string, unknown>;
			expect(({} as any).polluted).toBeUndefined();
			expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
			expect(out.ok).toBe(1);
		});
	});

	it('parses JSON and drops null filter values', async () => {
		const pipe = new ParseJsonPipe();
		await expect(
			pipe.transform(JSON.stringify({ findInput: { organizationId: 'org', employeeId: null }, relations: ['user'] }), meta)
		).resolves.toEqual({ findInput: { organizationId: 'org' }, relations: ['user'] });
	});

	it('returns {} for a non-JSON value by default and throws when configured to', async () => {
		await expect(new ParseJsonPipe().transform('not-json', meta)).resolves.toEqual({});
		await expect(new ParseJsonPipe({ throwInvalidError: true }).transform('not-json', meta)).rejects.toThrow(
			'Validation failed (JSON string is expected)'
		);
	});
});
