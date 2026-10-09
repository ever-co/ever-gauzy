import { BadRequestException } from '@nestjs/common';
import { canonicalizeFindOptionsRelations, normalizeRelationsToPaths } from './utils';

/**
 * `relations` reaches the API in four shapes — a comma-separated string, the legacy string array the
 * Angular clients send as `relations[0]=…`, TypeORM v1's nested object form (what Express's extended
 * query parser builds from `?relations[organization][payments]=x`), and any mixture of them — and
 * TypeORM joins all four. An authorization check that understands only some of them is not a check:
 * reading only the array and string forms is exactly how `SensitiveRelationsInterceptor` was bypassed
 * (GHSA-c3cj-m3xm-7j5h).
 *
 * These specs pin the one canonicalization both the interceptor and the CRUD read path now use.
 */
describe('normalizeRelationsToPaths', () => {
	describe('string form', () => {
		it('reads a single path', () => {
			expect(normalizeRelationsToPaths('organization')).toEqual(['organization']);
		});

		it('splits a comma-separated list and trims it', () => {
			expect(normalizeRelationsToPaths(' tags , user ')).toEqual(['tags', 'user']);
		});

		it('emits every prefix of a dotted path', () => {
			expect(normalizeRelationsToPaths('organization.payments.invoice')).toEqual([
				'organization',
				'organization.payments',
				'organization.payments.invoice'
			]);
		});

		it('drops empty segments from malformed input', () => {
			expect(normalizeRelationsToPaths('organization..payments')).toEqual([
				'organization',
				'organization.payments'
			]);
			expect(normalizeRelationsToPaths(',,')).toEqual([]);
		});
	});

	describe('array form', () => {
		it('reads the legacy string array the clients send', () => {
			expect(normalizeRelationsToPaths(['user', 'organization'])).toEqual(['user', 'organization']);
		});

		it('emits every prefix and de-duplicates shared ones', () => {
			expect(normalizeRelationsToPaths(['organization.payments', 'organization.contact'])).toEqual([
				'organization',
				'organization.payments',
				'organization.contact'
			]);
		});

		it('reads objects nested inside the array', () => {
			expect(normalizeRelationsToPaths([{ organization: { payments: true } }, 'tags'])).toEqual([
				'organization',
				'organization.payments',
				'tags'
			]);
		});
	});

	describe('object form (the bypassed representation)', () => {
		it('reads the nested object the extended query parser produces', () => {
			expect(normalizeRelationsToPaths({ organization: { payments: { invoice: 'x' } } })).toEqual([
				'organization',
				'organization.payments',
				'organization.payments.invoice'
			]);
		});

		it('emits a path for a key whatever its leaf value is', () => {
			// TypeORM joins `{ payments: <object> }` regardless of what the leaf holds, so a check that
			// cannot interpret the leaf must still see the relation rather than skip it.
			expect(normalizeRelationsToPaths({ payments: 'x' })).toEqual(['payments']);
			expect(normalizeRelationsToPaths({ payments: 1 })).toEqual(['payments']);
			expect(normalizeRelationsToPaths({ payments: false })).toEqual(['payments']);
			expect(normalizeRelationsToPaths({ payments: true })).toEqual(['payments']);
		});

		it('reads an array nested under an object key', () => {
			expect(normalizeRelationsToPaths({ organization: ['payments', 'contact'] })).toEqual([
				'organization',
				'organization.payments',
				'organization.contact'
			]);
		});
	});

	describe('unsafe and unusable input', () => {
		it('refuses a prototype-polluting segment instead of dropping its branch', () => {
			// Dropping the branch would leave the check answering for a request it never saw: neither
			// the interceptor nor the CRUD sink rewrites the value, so the ORM would still receive it.
			const polluted = JSON.parse('{"__proto__":{"payments":true},"constructor":{"contact":true}}');

			expect(() => normalizeRelationsToPaths(polluted)).toThrow(BadRequestException);
			expect(() => normalizeRelationsToPaths(['__proto__.payments'])).toThrow(BadRequestException);
			expect(() => normalizeRelationsToPaths('tags,prototype')).toThrow(BadRequestException);
			expect(() => normalizeRelationsToPaths({ organization: { constructor: true } })).toThrow(
				BadRequestException
			);
			expect(({} as any).payments).toBeUndefined();
		});

		it('refuses a dotted path longer than the bound, however it is spelled', () => {
			// A flat dotted string never recursed, so it used to escape the depth bound entirely and
			// cost a quadratic series of prefix copies.
			const segments = (count: number): string =>
				Array.from({ length: count }, (_value: unknown, i: number) => (i % 2 ? 'tags' : 'organization')).join(
					'.'
				);

			expect(normalizeRelationsToPaths(segments(20))).toHaveLength(20);
			expect(() => normalizeRelationsToPaths(segments(21))).toThrow(BadRequestException);
			expect(() => normalizeRelationsToPaths([segments(5000)])).toThrow(BadRequestException);
			expect(() => canonicalizeFindOptionsRelations(segments(21))).toThrow(BadRequestException);

			// The prefix a nested key already contributed counts toward the same bound.
			expect(() => normalizeRelationsToPaths({ organization: [segments(20)] })).toThrow(BadRequestException);
			expect(() => normalizeRelationsToPaths({ [segments(15)]: { [segments(6)]: true } })).toThrow(
				BadRequestException
			);
		});

		it('returns nothing for values that name no relation', () => {
			expect(normalizeRelationsToPaths(undefined)).toEqual([]);
			expect(normalizeRelationsToPaths(null)).toEqual([]);
			expect(normalizeRelationsToPaths(42)).toEqual([]);
			expect(normalizeRelationsToPaths(true)).toEqual([]);
			expect(normalizeRelationsToPaths({})).toEqual([]);
			expect(normalizeRelationsToPaths([])).toEqual([]);
		});

		it('refuses a pathologically nested payload instead of blowing the stack', () => {
			let payload: any = true;
			for (let i = 0; i < 5000; i++) {
				payload = { organization: payload };
			}

			expect(() => normalizeRelationsToPaths(payload)).toThrow(BadRequestException);
		});

		it('refuses — rather than truncates — a structure nested past the depth bound', () => {
			// Truncating fails OPEN: the paths past the bound are dropped from the check while TypeORM
			// still joins the structure it was handed. `organization` and the back-relation every
			// `TenantOrganizationBaseEntity` carries form a cycle, so an attacker can chain real hops
			// (`organization.tags.organization.tags…`) until the bound is reached and hang `payments`
			// off the far end. A depth the canonicalization cannot walk must be a refusal.
			const deep = (hops: number): unknown => {
				let node: unknown = { payments: { invoice: 'x' } };
				for (let i = hops; i > 0; i--) {
					node = { [i % 2 === 1 ? 'organization' : 'tags']: node };
				}
				return node;
			};

			// Within the bound the protected leaf is still offered to the check.
			expect(normalizeRelationsToPaths(deep(3))).toContain('organization.tags.organization.payments');

			// Past it, the whole structure is refused rather than silently shortened.
			expect(() => normalizeRelationsToPaths(deep(21))).toThrow(BadRequestException);
			expect(() => canonicalizeFindOptionsRelations(deep(21))).toThrow(BadRequestException);
		});
	});
});

describe('canonicalizeFindOptionsRelations', () => {
	it('leaves a value absent when none was supplied', () => {
		expect(canonicalizeFindOptionsRelations(undefined)).toBeUndefined();
		expect(canonicalizeFindOptionsRelations(null)).toBeUndefined();
	});

	it('converts every representation to the same TypeORM object form', () => {
		const expected = { organization: { payments: true } };

		expect(canonicalizeFindOptionsRelations('organization.payments')).toEqual(expected);
		expect(canonicalizeFindOptionsRelations(['organization.payments'])).toEqual(expected);
		expect(canonicalizeFindOptionsRelations({ organization: { payments: true } })).toEqual(expected);
		expect(canonicalizeFindOptionsRelations({ organization: { payments: { invoice: 'x' } } })).toEqual(expected);
	});

	it('never rebuilds a leaf TypeORM would not join as one it will', () => {
		// TypeORM's `buildRelations` joins a relation only for a `true` or object leaf. Turning `false` —
		// or the string a query parameter always carries — into `true` would widen the caller's query.
		expect(canonicalizeFindOptionsRelations({ payments: false })).toEqual({});
		expect(canonicalizeFindOptionsRelations({ organization: { payments: false }, user: true })).toEqual({
			organization: true,
			user: true
		});
		expect(canonicalizeFindOptionsRelations({ organization: { payments: 'x' } })).toEqual({ organization: true });
		expect(canonicalizeFindOptionsRelations({ payments: 'true', contact: 1 })).toEqual({});

		// The authorization walk is deliberately stricter and still names every key.
		expect(normalizeRelationsToPaths({ payments: false })).toEqual(['payments']);
	});

	it('keeps the shape the Angular clients send intact', () => {
		// `toParams` encodes `['user', 'organization']` as `relations[0]=user&relations[1]=organization`,
		// which the query parser hands over as a plain array.
		expect(canonicalizeFindOptionsRelations(['user', 'organization', 'organization.contact'])).toEqual({
			user: true,
			organization: { contact: true }
		});
	});

	it('is idempotent', () => {
		const once = canonicalizeFindOptionsRelations({ organization: { employees: { user: true } } });
		expect(canonicalizeFindOptionsRelations(once)).toEqual(once);
	});

	it('never introduces a prototype-polluting key', () => {
		expect(() => canonicalizeFindOptionsRelations(JSON.parse('{"__proto__":{"payments":true}}'))).toThrow(
			BadRequestException
		);
		expect(({} as any).payments).toBeUndefined();
	});
});
