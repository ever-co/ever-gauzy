import { EntityCaseNamingStrategy, EntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { In, IsNull, LessThan, Not } from 'typeorm';
import { MikroOrmBaseEntityRepository } from '../repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';

/**
 * `CrudService.update` writes under MikroORM what TypeORM's update writes without being asked.
 *
 * TypeORM's update query sets the `@UpdateDateColumn` to the current time and increments the `@VersionColumn`
 * unless the payload states them. MikroORM's `nativeUpdate` runs no `onUpdate` hook and never touches a version,
 * so under `DB_ORM=mikro-orm` `updatedAt` stayed at the row's creation time through every `update()`, and a
 * compare-and-set on `{ id, version }` — the token status transitions — never moved the version, so a second
 * writer holding the same version still matched. The store here is MikroORM on in-memory better-sqlite3.
 */

class VersionedRow {
	id!: string;
	label?: string;
	updatedAt?: Date;
	version!: number;
}

const VersionedRowSchema = new EntitySchema<VersionedRow>({
	class: VersionedRow,
	tableName: 'versioned_row',
	properties: {
		id: { type: 'string', primary: true },
		label: { type: 'string', nullable: true },
		updatedAt: { type: 'Date', nullable: true, onCreate: () => new Date(), onUpdate: () => new Date() },
		// As `Token.version` is mapped for MikroORM: a plain integer, since `version: true` expects a default.
		version: { type: 'integer', onCreate: (row: VersionedRow) => row.version ?? 1 }
	}
});

class VersionedRowService extends CrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}
}

/** TypeORM's metadata as it describes the table: the `@VersionColumn` it names. */
const typeOrm = { metadata: { versionColumn: { propertyName: 'version' } } };

const EARLIER = new Date('2020-01-01T00:00:00.000Z');

describe('CrudService.update under MikroORM', () => {
	let orm: MikroORM<BetterSqliteDriver>;

	const service = () =>
		new VersionedRowService(
			typeOrm,
			new MikroOrmBaseEntityRepository<VersionedRow>(orm.em.fork() as any, VersionedRow)
		);
	const stored = async (): Promise<{ label: string; updatedAt: number; version: number }> => {
		const rows: any[] = await orm.em
			.getConnection()
			.execute('SELECT label, updatedAt, version FROM versioned_row WHERE id = ?', ['r1']);
		return rows[0];
	};

	beforeAll(async () => {
		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [VersionedRowSchema],
			namingStrategy: EntityCaseNamingStrategy,
			allowGlobalContext: true
		});
		// As the platform's migrations leave `tokens.version`: NOT NULL, and no default.
		await orm.em
			.getConnection()
			.execute(
				'CREATE TABLE versioned_row (id varchar PRIMARY KEY NOT NULL, label varchar NULL, updatedAt datetime NULL, version integer NOT NULL)'
			);
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	beforeEach(async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		await orm.em.getConnection().execute('DELETE FROM versioned_row');
		await orm.em
			.getConnection()
			.execute('INSERT INTO versioned_row (id, label, updatedAt, version) VALUES (?, ?, ?, ?)', [
				'r1',
				'first',
				EARLIER.getTime(),
				1
			]);
	});

	afterEach(() => jest.restoreAllMocks());

	it('sets the update date and increments the version, as TypeORM does', async () => {
		await service().update('r1', { label: 'second' });

		const row = await stored();
		expect(row.label).toBe('second');
		expect(row.version).toBe(2);
		expect(Number(row.updatedAt)).toBeGreaterThan(EARLIER.getTime());
	});

	it('makes a compare-and-set on the version exclusive: a second writer holding it matches nothing', async () => {
		const first = await service().update({ id: 'r1', version: 1 } as any, { label: 'first writer' });
		const second = await service().update({ id: 'r1', version: 1 } as any, { label: 'second writer' });

		expect(first).toEqual({ affected: 1 });
		expect(second).toEqual({ affected: 0 });
		expect(await stored()).toMatchObject({ label: 'first writer', version: 2 });
	});

	it('keeps an update date or version the payload states', async () => {
		const stated = new Date('2024-06-01T00:00:00.000Z');
		await service().update('r1', { label: 'stated', updatedAt: stated, version: 7 } as any);

		expect(await stored()).toMatchObject({ label: 'stated', updatedAt: stated.getTime(), version: 7 });
	});

	it('writes 1 as the version of a row it creates, where MikroORM would have left the column out', async () => {
		const created = await service().create({ id: 'r2', label: 'new' } as any);

		expect(created.version).toBe(1);
		const [row] = await orm.em.getConnection().execute('SELECT version FROM versioned_row WHERE id = ?', ['r2']);
		expect(row.version).toBe(1);
	});

	describe('translates TypeORM operators in the criteria (#10670)', () => {
		const LATER = new Date('2030-01-01T00:00:00.000Z');

		/** r1 (above), r2 with no label and the earlier date, r3 with a label and the later date. */
		beforeEach(async () => {
			await orm.em
				.getConnection()
				.execute(
					'INSERT INTO versioned_row (id, label, updatedAt, version) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
					['r2', null, EARLIER.getTime(), 1, 'r3', 'third', LATER.getTime(), 1]
				);
		});

		const labels = async (): Promise<Record<string, string | null>> => {
			const rows: any[] = await orm.em.getConnection().execute('SELECT id, label FROM versioned_row ORDER BY id');
			return Object.fromEntries(rows.map(({ id, label }) => [id, label]));
		};

		it('updates the rows an In() names, and only those', async () => {
			// Untranslated, the criterion reached the statement as the text '[object Object]' and matched nothing.
			await expect(service().update({ id: In(['r1', 'r2']) } as any, { label: 'in' })).resolves.toEqual({
				affected: 2
			});

			expect(await labels()).toEqual({ r1: 'in', r2: 'in', r3: 'third' });
		});

		it('updates the rows an IsNull() matches, and only those', async () => {
			await expect(service().update({ label: IsNull() } as any, { label: 'was null' })).resolves.toEqual({
				affected: 1
			});

			expect(await labels()).toEqual({ r1: 'first', r2: 'was null', r3: 'third' });
		});

		it('updates the rows a LessThan() on a date matches, and only those', async () => {
			const cutoff = new Date('2025-01-01T00:00:00.000Z');
			await expect(
				service().update({ updatedAt: LessThan(cutoff) } as any, { label: 'expired' })
			).resolves.toEqual({ affected: 2 });

			expect(await labels()).toEqual({ r1: 'expired', r2: 'expired', r3: 'third' });
		});

		it('keeps a Date stated as the criterion a predicate rather than dropping it', async () => {
			await expect(service().update({ updatedAt: LATER } as any, { label: 'dated' })).resolves.toEqual({
				affected: 1
			});

			expect(await labels()).toEqual({ r1: 'first', r2: null, r3: 'dated' });
		});

		it('combines an operator with a plain condition, as the tenant-aware update states them', async () => {
			await expect(
				service().update({ id: In(['r1', 'r2', 'r3']), label: Not(IsNull()) } as any, { label: 'both' })
			).resolves.toEqual({ affected: 2 });

			expect(await labels()).toEqual({ r1: 'both', r2: null, r3: 'both' });
		});
	});

	it('passes the payload on untouched to a stand-in that is not a MikroORM repository', async () => {
		const nativeUpdate = jest.fn(async () => 1);
		await new VersionedRowService(typeOrm, { nativeUpdate }).update('r1', { label: 'plain' });

		expect(nativeUpdate).toHaveBeenCalledWith({ id: 'r1' }, { label: 'plain' });
	});
});
