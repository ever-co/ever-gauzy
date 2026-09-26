/**
 * Hostname → channel resolution (schema chapter §3.2).
 *
 * Three rules, and the suite walks each of them: a hostname is stored in exactly one normalised form, a
 * hostname resolves to one channel across the whole deployment, and exactly one hostname per channel is
 * primary. The last hostname of a channel is refused on removal, because a channel nobody can resolve to
 * cannot serve — invariant I-25.
 *
 * The base CRUD class is doubled, because it reaches the entity barrel and with it the whole application
 * graph. The service under test is the real one, over an in-memory table that applies the `where` the
 * service states.
 */
jest.mock('../core/crud/tenant-aware-crud.service', () => {
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async softDelete(id: any): Promise<any> {
			return this.typeOrmRepository.update(id, { deletedAt: new Date() });
		}
	}

	return { TenantAwareCrudService };
});

jest.mock('../core/context/request-context', () => ({
	RequestContext: {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => '00000000-0000-4000-8000-000000000001',
		currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
		currentEmployeeId: () => null,
		hasPermission: () => false
	}
}));

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	// The suite runs as Postgres so the row lock the primary path takes is the statement a production
	// deployment issues, rather than the embedded dialect's no-op.
	isPostgres: () => true,
	isMySQL: () => false
}));

import { ChannelDomain } from './channel-domain.entity';
import { ChannelDomainService } from './channel-domain.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL = 'channel-1';
const OTHER_CHANNEL = 'channel-2';

type Row = Record<string, any>;

const ENTITY_TABLES = new Map<unknown, string>([[ChannelDomain, 'channel_domain']]);

/**
 * An in-memory stand-in for the hostname table and the transaction manager it is written through.
 *
 * The soft-delete column is part of the equality the double applies, so a withdrawn hostname stops
 * resolving here for the same reason it stops resolving in the database.
 */
function world(seed: { domains?: Row[] } = {}) {
	const tables: Record<string, Row[]> = { channel_domain: [...(seed.domains ?? [])] };
	const locks: string[] = [];
	let sequence = 0;

	const tableOf = (entity: unknown): string => {
		const table = ENTITY_TABLES.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return table;
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			if (expected === undefined) {
				return true;
			}

			if (expected === null) {
				return row[field] === null || row[field] === undefined;
			}

			return String(row[field] ?? '') === String(expected);
		});
	const save = (table: string, row: Row): Row => {
		if (row.id) {
			const index = tables[table].findIndex((one) => one.id === row.id);

			if (index >= 0) {
				tables[table][index] = { ...tables[table][index], ...row };

				return tables[table][index];
			}
		}

		const created = { id: `${table}-${++sequence}`, createdAt: new Date(), ...row };

		tables[table].push(created);

		return created;
	};

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => run(manager),
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rows: Row | Row[]) => {
			const list = Array.isArray(rows) ? rows : [rows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null,
		createQueryBuilder: (entity: unknown, _alias: string) => {
			const conditions: Row[] = [];
			const builder: any = {
				where: (where: Row) => {
					conditions.push(where);

					return builder;
				},
				andWhere: (where: Row) => {
					conditions.push(where);

					return builder;
				},
				setLock: (mode: string) => {
					locks.push(`${tableOf(entity)}:${mode}`);

					return builder;
				},
				getOne: async () =>
					tables[tableOf(entity)].find((row) => conditions.every((one) => matches(row, one))) ?? null
			};

			return builder;
		}
	};

	const repository = {
		manager,
		metadata: { tableName: 'channel_domain', hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables.channel_domain.filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) =>
			tables.channel_domain.find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables.channel_domain.find((row) => matches(row, where)) ?? null,
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => save('channel_domain', row),
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables.channel_domain.findIndex((row) => row.id === id);

			if (index >= 0) {
				Object.assign(tables.channel_domain[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};

	return {
		tables,
		locks,
		domain: (id: string) => tables.channel_domain.find((row) => row.id === id),
		byHostname: (hostname: string) =>
			tables.channel_domain.find((row) => row.hostname === hostname && !row.deletedAt),
		service: new ChannelDomainService(repository as never, {} as never)
	};
}

/** One `channel_domain` row, with the fields this suite reads. */
const domainRow = (id: string, hostname: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	channelId: CHANNEL,
	hostname,
	isPrimary: false,
	isSslEnabled: true,
	redirectToPrimary: false,
	...overrides
});

/** The message of the error a call raises, or `undefined` when the call does not raise. */
async function refusalOf(call: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await call();

		return undefined;
	} catch (error) {
		return (error as Error).message;
	}
}

describe('ChannelDomainService — one stored form for a hostname', () => {
	it('reduces a host to its single stored form', () => {
		const { service } = world();

		expect(service.normaliseHostname('HTTPS://Shop.Example.COM/Store?x=1')).toBe('shop.example.com');
		expect(service.normaliseHostname('shop.example.com:8443')).toBe('shop.example.com');
		expect(service.normaliseHostname('Shop.Example.COM.')).toBe('shop.example.com');
		expect(service.normaliseHostname('  shop.example.com  ')).toBe('shop.example.com');
	});

	it('refuses a value that is not a hostname', async () => {
		const { service } = world();

		expect(await refusalOf(async () => service.normaliseHostname('not a host'))).toMatch(
			/^VALIDATION_FAILED: CHANNEL_DOMAIN_HOSTNAME_INVALID/
		);
		expect(await refusalOf(async () => service.normaliseHostname(''))).toMatch(
			/^VALIDATION_FAILED: CHANNEL_DOMAIN_HOSTNAME_INVALID/
		);
		// The resolution path answers `null` instead of raising: a request with a nonsense header resolves
		// to no channel rather than failing the whole request.
		expect(service.normaliseHostname('not a host', false)).toBe('');
	});
});

describe('ChannelDomainService — binding a hostname', () => {
	it('binds the first hostname as the channel primary, whatever the body says', async () => {
		const store = world();

		const bound = await store.service.bindDomain({ channelId: CHANNEL, hostname: 'HTTPS://Shop.Example.com/' });

		expect(bound.hostname).toBe('shop.example.com');
		expect(bound.isPrimary).toBe(true);
		expect(bound.isSslEnabled).toBe(true);
		expect(bound.redirectToPrimary).toBe(false);
		expect(bound.tenantId).toBe(TENANT);
		expect(store.byHostname('shop.example.com')).toBeDefined();
	});

	it('binds a later hostname as non-primary unless the body claims the flag', async () => {
		const store = world({ domains: [domainRow('domain-1', 'shop.example.com', { isPrimary: true })] });

		const bound = await store.service.bindDomain({ channelId: CHANNEL, hostname: 'www.example.com' });

		expect(bound.isPrimary).toBe(false);
	});

	it('refuses a second primary on a channel that already publishes one', async () => {
		const store = world({ domains: [domainRow('domain-1', 'shop.example.com', { isPrimary: true })] });

		expect(
			await refusalOf(() =>
				store.service.bindDomain({ channelId: CHANNEL, hostname: 'other.example.com', isPrimary: true })
			)
		).toMatch(/^UNIQUE_CONSTRAINT_VIOLATION: CHANNEL_DOMAIN_PRIMARY_EXISTS/);
		expect(store.byHostname('other.example.com')).toBeUndefined();
	});

	it('refuses a hostname already bound anywhere in the deployment, and names the channel that owns it', async () => {
		const store = world({
			domains: [domainRow('domain-1', 'shop.example.com', { channelId: OTHER_CHANNEL, organizationId: 'other-org' })]
		});

		const refusal = await refusalOf(() =>
			store.service.bindDomain({ channelId: CHANNEL, hostname: 'Shop.Example.com' })
		);

		expect(refusal).toMatch(/^UNIQUE_CONSTRAINT_VIOLATION: CHANNEL_DOMAIN_ALREADY_EXISTS/);
		expect(refusal).toContain(OTHER_CHANNEL);
	});

	it('refuses a binding with no channel or no hostname', async () => {
		const store = world();

		expect(await refusalOf(() => store.service.bindDomain({ channelId: '', hostname: 'shop.example.com' }))).toMatch(
			/^VALIDATION_REQUIRED_FIELD/
		);
		expect(await refusalOf(() => store.service.bindDomain({ channelId: CHANNEL, hostname: '' }))).toMatch(
			/^VALIDATION_FAILED: CHANNEL_DOMAIN_HOSTNAME_INVALID/
		);
	});
});

describe('ChannelDomainService — resolution, which is the read the guard is built on', () => {
	it('resolves a host to its channel without being scoped by tenant', async () => {
		const store = world({
			domains: [domainRow('domain-1', 'shop.example.com', { tenantId: 'another-tenant', organizationId: 'another-org' })]
		});

		expect(await store.service.resolveChannelIdByHostname('HTTPS://SHOP.example.com:443/path')).toBe(CHANNEL);
	});

	it('answers null for a host nothing is bound to, and for a value that is not a host', async () => {
		const store = world({ domains: [domainRow('domain-1', 'shop.example.com')] });

		expect(await store.service.resolveChannelIdByHostname('unknown.example.com')).toBeNull();
		expect(await store.service.resolveChannelIdByHostname('not a host')).toBeNull();
	});

	it('stops resolving a withdrawn hostname', async () => {
		const store = world({ domains: [domainRow('domain-1', 'shop.example.com', { deletedAt: new Date() })] });

		expect(await store.service.resolveChannelIdByHostname('shop.example.com')).toBeNull();
	});

	it('finds the primary host of a channel', async () => {
		const store = world({
			domains: [
				domainRow('domain-1', 'shop.example.com', { isPrimary: true }),
				domainRow('domain-2', 'www.example.com')
			]
		});

		expect((await store.service.findPrimaryDomain(CHANNEL))?.hostname).toBe('shop.example.com');
		expect(await store.service.findPrimaryDomain(OTHER_CHANNEL)).toBeNull();
	});
});

describe('ChannelDomainService — one primary per channel, moved and never duplicated', () => {
	it('moves the flag from the current primary in one transaction', async () => {
		const store = world({
			domains: [
				domainRow('domain-1', 'shop.example.com', { isPrimary: true }),
				domainRow('domain-2', 'www.example.com')
			]
		});

		await store.service.setPrimaryDomain(CHANNEL, 'domain-2');

		expect(store.domain('domain-2')?.isPrimary).toBe(true);
		expect(store.domain('domain-1')?.isPrimary).toBe(false);
		expect(store.locks).toContain('channel_domain:pessimistic_write');
	});

	it('moves the flag through an update rather than refusing it', async () => {
		const store = world({
			domains: [
				domainRow('domain-1', 'shop.example.com', { isPrimary: true }),
				domainRow('domain-2', 'www.example.com')
			]
		});

		const updated = await store.service.updateDomain('domain-2', { isPrimary: true, redirectToPrimary: true });

		expect(updated.isPrimary).toBe(true);
		expect(updated.redirectToPrimary).toBe(true);
		expect(store.domain('domain-1')?.isPrimary).toBe(false);
	});
});

describe('ChannelDomainService — removal and the servability invariant (I-25)', () => {
	it('refuses to remove the last hostname of a channel, and allows it when forced', async () => {
		const store = world({ domains: [domainRow('domain-1', 'shop.example.com', { isPrimary: true })] });

		expect(await refusalOf(() => store.service.unbindDomain('domain-1'))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_SETUP_INCOMPLETE/
		);
		expect(store.domain('domain-1')?.deletedAt).toBeUndefined();

		await store.service.unbindDomain('domain-1', { force: true });

		expect(store.domain('domain-1')?.deletedAt).toBeInstanceOf(Date);
	});

	it('removes a hostname when the channel keeps another one', async () => {
		const store = world({
			domains: [
				domainRow('domain-1', 'shop.example.com', { isPrimary: true }),
				domainRow('domain-2', 'www.example.com')
			]
		});

		await store.service.unbindDomain('domain-2');

		expect(store.domain('domain-2')?.deletedAt).toBeInstanceOf(Date);
		expect(await store.service.resolveChannelIdByHostname('www.example.com')).toBeNull();
	});

	it('refuses a channel that no hostname resolves to', async () => {
		const store = world();

		expect(await refusalOf(() => store.service.assertServable(CHANNEL))).toMatch(
			/^PRECONDITION_REQUIRED: CHANNEL_SETUP_INCOMPLETE/
		);

		const bound = world({ domains: [domainRow('domain-1', 'shop.example.com')] });

		await expect(bound.service.assertServable(CHANNEL)).resolves.toBeUndefined();
	});

	it('scopes every read to the caller, so a hostname of another organization is not found', async () => {
		const store = world({
			domains: [domainRow('domain-1', 'shop.example.com', { organizationId: 'another-org' })]
		});

		expect(await store.service.findDomain('domain-1')).toBeNull();
		expect(await refusalOf(() => store.service.findDomainOrFail('domain-1'))).toMatch(
			/^RESOURCE_NOT_FOUND: CHANNEL_DOMAIN_NOT_FOUND/
		);
	});
});
