/**
 * The lease fence (plan 03 §C.4) on a real database (better-sqlite3) with its ORM subscriber registered:
 * a write of a fenced unit lands only while this process holds the connection's lease — checked in the
 * write's own transaction (the owner decides, the lock holds the lease still) or, outside one, with the
 * margin — and a unit whose lease moved writes nothing more and ends with `EverWorksLeaseLostError`,
 * whatever its code made of the refusal. Writes outside a fence and writes of the lease row are never
 * checked; a unit that keeps writing renews its lease, but never takes one over.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {}
	};
});

import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntitySchema } from 'typeorm';
import { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksSyncLog } from './entities/ever-works-sync.entities';
import {
	EVER_WORKS_SYNC_LEASE_MS,
	EverWorksLease,
	EverWorksLeaseFenceSubscriber,
	EverWorksLeaseLostError,
	everWorksLease,
	isLeaseFenced,
	LEASE_FENCE_MARGIN_MS,
	LEASE_FENCE_RENEW_MS,
	pendingLeaseRenewal,
	renewLease,
	withLeaseFence
} from './ever-works-lease-fence';

jest.setTimeout(60_000);

const base = {
	id: { type: String, primary: true },
	tenantId: { type: String, nullable: true },
	organizationId: { type: String, nullable: true },
	createdAt: { type: Date, createDate: true },
	updatedAt: { type: Date, updateDate: true }
} as const;
const schemas = [
	new EntitySchema({
		name: 'EverWorksConnection',
		target: EverWorksConnection,
		tableName: 'ever_works_connection',
		columns: { ...base, leaseOwner: { type: String, nullable: true }, leaseUntil: { type: Date, nullable: true } } as never
	}),
	new EntitySchema({
		name: 'EverWorksSyncLog',
		target: EverWorksSyncLog,
		tableName: 'ever_works_sync_log',
		columns: { ...base, direction: { type: String }, action: { type: String }, status: { type: String }, message: { type: 'text', nullable: true } } as never
	})
];

describe('Ever Works lease fence on SQLite', () => {
	let dir: string;
	let dataSource: DataSource;
	const C = 'connection-1';

	const leases = () => dataSource.getRepository(EverWorksConnection);
	const logs = () => dataSource.getRepository(EverWorksSyncLog);
	/** The lease row as the loop's claim leaves it: `owner` holds it until `inMs` from now. */
	const hold = (owner: string | null, inMs = EVER_WORKS_SYNC_LEASE_MS) =>
		leases().update({ id: C } as never, { leaseOwner: owner, leaseUntil: owner ? new Date(Date.now() + inMs) : null } as never);
	// A sync log row stands for any Gauzy write (the fence is the same for every entity).
	const row = (message: string) => ({ id: randomUUID(), direction: 'inbound', action: 'apply', status: 'ok', message }) as never;
	const lease = (owner: string): EverWorksLease => everWorksLease(dataSource, C, owner);
	const count = () => logs().count();

	beforeAll(async () => {
		dir = mkdtempSync(join(tmpdir(), 'ever-works-lease-fence-'));
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: join(dir, 'gauzy.sqlite'),
			entities: schemas,
			subscribers: [EverWorksLeaseFenceSubscriber],
			synchronize: true
		});
		await dataSource.initialize();
	});

	afterAll(async () => {
		await dataSource?.destroy();
		rmSync(dir, { recursive: true, force: true });
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM "ever_works_sync_log"');
		await dataSource.query('DELETE FROM "ever_works_connection"');
		await leases().insert({ id: C } as never);
		await hold('A');
	});

	it('lets the writes of a fenced unit land while this process holds the lease (in a transaction and outside one)', async () => {
		const written = await withLeaseFence(lease('A'), async () => {
			expect(isLeaseFenced()).toBe(true);
			await logs().save(row('save: in its transaction'));
			await logs().insert(row('insert: outside a transaction'));
			const id = randomUUID();
			await dataSource.transaction((manager) => manager.getRepository(EverWorksSyncLog).insert({ ...(row('in transaction()') as object), id } as never));
			await logs().update({ id } as never, { message: 'updated' } as never);
			return 'done';
		});
		expect(written).toBe('done');
		expect(isLeaseFenced()).toBe(false);
		expect(await count()).toBe(3);
		expect(await logs().count({ where: { message: 'updated' } as never })).toBe(1);
	});

	it('refuses the write before it lands once another process holds the lease, and ends the unit with EverWorksLeaseLostError', async () => {
		await hold('B');
		await expect(withLeaseFence(lease('A'), () => logs().save(row('stale save')))).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		await expect(withLeaseFence(lease('A'), () => logs().insert(row('stale insert')))).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		expect(await count()).toBe(0);
	});

	it('the lease moving in the middle of a unit: what it wrote before stays, every later write is refused (even if the lease came back)', async () => {
		const attempts: string[] = [];
		await expect(
			withLeaseFence(lease('A'), async () => {
				await logs().save(row('before the takeover'));
				// Another process claims the lease (a write of the lease row itself is never fenced).
				await hold('B');
				for (const message of ['after the takeover', 'once it is ours again']) {
					try {
						await logs().insert(row(message));
					} catch (error) {
						attempts.push(error instanceof EverWorksLeaseLostError ? 'refused' : 'other');
					}
					await hold('A');
				}
				return 'applied';
			})
		).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		expect(attempts).toEqual(['refused', 'refused']);
		expect((await logs().find()).map((log) => log.message)).toEqual(['before the takeover']);
	});

	it('ends the unit with EverWorksLeaseLostError whatever the handler made of the refusal (swallowed or rethrown as another error)', async () => {
		await hold('B');
		await expect(
			withLeaseFence(lease('A'), async () => {
				await logs()
					.insert(row('swallowed'))
					.catch(() => undefined);
				return { status: 'applied' };
			})
		).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		await expect(
			withLeaseFence(lease('A'), async () => {
				try {
					await logs().save(row('wrapped'));
				} catch {
					throw new Error('Bad request');
				}
			})
		).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		expect(await count()).toBe(0);
	});

	it('outside a transaction the lease must last past the margin; inside one, the owner and the lock decide', async () => {
		// Ours, but running out: a statement on its own could be overtaken by a claim right after the check.
		await hold('A', LEASE_FENCE_MARGIN_MS / 3);
		await expect(withLeaseFence(lease('A'), () => logs().insert(row('outside')))).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		// In a transaction the read of the lease row holds it until the write commits: no claim gets in between.
		await withLeaseFence(lease('A'), () => logs().save(row('inside')));
		// Ran out and nobody took it yet: still ours inside a transaction (nobody else wrote), not outside one.
		await hold('A', -1_000);
		await withLeaseFence(lease('A'), () => logs().save(row('inside, ran out')));
		await expect(withLeaseFence(lease('A'), () => logs().insert(row('outside, ran out')))).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		expect((await logs().find({ order: { createdAt: 'ASC' } as never })).map((log) => log.message).sort()).toEqual(['inside', 'inside, ran out']);
	});

	it('never checks a write outside a fence, nor a write of the lease row itself', async () => {
		await hold('B');
		await logs().insert(row('an API request'));
		await withLeaseFence(null, () => logs().insert(row('no lease given (an admin action)')));
		await withLeaseFence(lease('A'), async () => {
			await leases().update({ id: C } as never, { leaseUntil: new Date(Date.now() + 60_000) } as never);
		});
		expect(await count()).toBe(2);
	});

	it('a unit nested in a unit of the same lease joins it', async () => {
		await expect(
			withLeaseFence(lease('A'), async () => {
				await hold('B');
				await withLeaseFence(lease('A'), () => logs().insert(row('inner')).catch(() => undefined));
				return 'outer';
			})
		).rejects.toBeInstanceOf(EverWorksLeaseLostError);
		expect(await count()).toBe(0);
	});

	it('renews the lease in the background while a unit keeps writing, and never takes over a lease that moved', async () => {
		let now = Date.now();
		const ticking: EverWorksLease = { dataSource, connectionId: C, owner: 'A', clock: () => now };
		await withLeaseFence(ticking, async () => {
			await logs().insert(row('first'));
			expect(pendingLeaseRenewal()).toBeNull(); // just renewed by the pass
			now += LEASE_FENCE_RENEW_MS + 1_000;
			await logs().insert(row('a minute later'));
			await pendingLeaseRenewal();
		});
		const renewed = await leases().findOneByOrFail({ id: C } as never);
		expect(renewed.leaseOwner).toBe('A');
		expect(new Date(renewed.leaseUntil as Date).getTime()).toBeGreaterThanOrEqual(now + EVER_WORKS_SYNC_LEASE_MS - 1_000);
		await hold('B');
		expect(await renewLease(lease('A'))).toBe(false);
		await hold(null);
		expect(await renewLease(lease('A'))).toBe(false); // a free lease is claimed by the loop, not renewed
		expect((await leases().findOneByOrFail({ id: C } as never)).leaseOwner).toBeNull();
	});
});
