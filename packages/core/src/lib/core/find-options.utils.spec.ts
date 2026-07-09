import {
	parseFindOptionsRelations,
	parseFindOptionsSelect,
	parseTypeORMFindOptions,
	stringArrayToFindOptionsObject
} from './utils';

/**
 * These specs pin the behaviour that replaces the runtime shim previously carried in
 * `patches/typeorm+1.0.0.patch`. The conversion must stay byte-for-byte compatible with that shim so
 * removing the patch does not change what reaches TypeORM.
 */
describe('stringArrayToFindOptionsObject', () => {
	it('returns an empty object for an empty array', () => {
		expect(stringArrayToFindOptionsObject([])).toEqual({});
	});

	it('converts a single flat relation', () => {
		expect(stringArrayToFindOptionsObject(['role'])).toEqual({ role: true });
	});

	it('converts several flat relations', () => {
		expect(stringArrayToFindOptionsObject(['id', 'name', 'email'])).toEqual({
			id: true,
			name: true,
			email: true
		});
	});

	it('nests a dot-notated path', () => {
		expect(stringArrayToFindOptionsObject(['tenant.featureOrganizations'])).toEqual({
			tenant: { featureOrganizations: true }
		});
	});

	it('nests a deep dot-notated path', () => {
		expect(stringArrayToFindOptionsObject(['a.b.c.d'])).toEqual({
			a: { b: { c: { d: true } } }
		});
	});

	it('upgrades a leaf to an object when a longer sibling path follows (parent first)', () => {
		expect(stringArrayToFindOptionsObject(['tenant', 'tenant.featureOrganizations'])).toEqual({
			tenant: { featureOrganizations: true }
		});
	});

	it('does NOT clobber an existing nested object when a shorter path follows (child first)', () => {
		// Order independence: the later bare `tenant` must not overwrite `{ featureOrganizations: true }`.
		expect(stringArrayToFindOptionsObject(['tenant.featureOrganizations', 'tenant'])).toEqual({
			tenant: { featureOrganizations: true }
		});
	});

	it('merges sibling nested paths under a shared parent', () => {
		expect(stringArrayToFindOptionsObject(['tenant.a', 'tenant.b'])).toEqual({
			tenant: { a: true, b: true }
		});
	});

	it('is idempotent for duplicate paths', () => {
		expect(stringArrayToFindOptionsObject(['role', 'role'])).toEqual({ role: true });
	});

	it('skips empty and non-string entries', () => {
		expect(stringArrayToFindOptionsObject(['role', '', null as any, undefined as any, 5 as any])).toEqual({
			role: true
		});
	});

	it('drops empty segments inside malformed dotted paths', () => {
		expect(stringArrayToFindOptionsObject(['tenant..settings', 'role.'])).toEqual({
			tenant: { settings: true },
			role: true
		});
	});

	it('rejects prototype-polluting paths without altering Object.prototype', () => {
		const result = stringArrayToFindOptionsObject([
			'__proto__',
			'role.__proto__',
			'constructor',
			'a.prototype.b',
			'role'
		]);

		// Only the safe `role` survives; every path containing a dangerous segment is dropped.
		expect(result).toEqual({ role: true });
		expect(({} as any).polluted).toBeUndefined();
		expect(Object.prototype).not.toHaveProperty('polluted');
	});

	it('does not pollute Object.prototype via a crafted __proto__ payload', () => {
		stringArrayToFindOptionsObject(['__proto__.polluted']);
		expect(({} as any).polluted).toBeUndefined();
	});
});

describe('parseFindOptionsRelations', () => {
	it('converts the legacy string-array form', () => {
		expect(parseFindOptionsRelations(['role', 'tenant.featureOrganizations'])).toEqual({
			role: true,
			tenant: { featureOrganizations: true }
		});
	});

	it('passes the object form through unchanged', () => {
		const relations = { role: true, tenant: { featureOrganizations: true } };
		expect(parseFindOptionsRelations(relations)).toBe(relations);
	});

	it('passes undefined through unchanged', () => {
		expect(parseFindOptionsRelations(undefined)).toBeUndefined();
	});
});

describe('parseFindOptionsSelect', () => {
	it('converts the legacy string-array form', () => {
		expect(parseFindOptionsSelect(['id', 'name', 'role.name'])).toEqual({
			id: true,
			name: true,
			role: { name: true }
		});
	});

	it('passes the object form through unchanged', () => {
		const select = { id: true, name: true };
		expect(parseFindOptionsSelect(select)).toBe(select);
	});
});

describe('parseTypeORMFindOptions', () => {
	it('converts array relations and select while preserving other options', () => {
		const where = { id: '1' };
		const order = { createdAt: 'DESC' as const };

		const result = parseTypeORMFindOptions({
			where,
			order,
			take: 10,
			skip: 2,
			withDeleted: true,
			relations: ['role', 'tenant.settings'],
			select: ['id', 'name']
		});

		expect(result).toEqual({
			where,
			order,
			take: 10,
			skip: 2,
			withDeleted: true,
			relations: { role: true, tenant: { settings: true } },
			select: { id: true, name: true }
		});
	});

	it('returns the same reference when nothing needs converting', () => {
		const options = { where: { id: '1' }, relations: { role: true } };
		expect(parseTypeORMFindOptions(options)).toBe(options);
	});

	it('does not mutate the input when converting', () => {
		const options = { relations: ['role'], where: { id: '1' } };
		const result = parseTypeORMFindOptions(options);

		expect(options.relations).toEqual(['role']);
		expect(result).not.toBe(options);
		expect(result.relations).toEqual({ role: true });
	});

	it('passes null/undefined through unchanged', () => {
		expect(parseTypeORMFindOptions(undefined as any)).toBeUndefined();
		expect(parseTypeORMFindOptions(null as any)).toBeNull();
	});
});
