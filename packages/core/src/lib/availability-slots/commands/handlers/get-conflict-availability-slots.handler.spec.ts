// Must stay first: loads the entity graph before the handler pulls an entity.
import '../../../core/entities/internal';

import { DataSource } from 'typeorm';
import { sqliteOverlapCondition } from './get-conflict-availability-slots.handler';

/**
 * The SQLite conflict condition run against stored availability slots. New slot: 10:00 - 11:00, given as
 * ISO strings as the handler does; stored as TypeORM writes a datetime to SQLite.
 */
describe('sqliteOverlapCondition', () => {
	const at = (time: string) => `2026-10-14 ${time}:00.000`;
	const iso = (time: string) => `2026-10-14T${time}:00.000Z`;
	const slots = {
		inside: [at('10:15'), at('10:45')],
		enclosing: [at('09:00'), at('12:00')],
		overlapsStart: [at('09:30'), at('10:30')],
		overlapsEnd: [at('10:30'), at('11:30')],
		same: [at('10:00'), at('11:00')],
		touchesStart: [at('09:00'), at('10:00')],
		touchesEnd: [at('11:00'), at('12:00')],
		before: [at('07:00'), at('08:00')],
		after: [at('12:00'), at('13:00')]
	};

	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', logging: false });
		await dataSource.initialize();
		await dataSource.query(
			'CREATE TABLE "availability_slot" ("id" varchar PRIMARY KEY, "startTime" varchar, "endTime" varchar)'
		);
		for (const [id, [startTime, endTime]] of Object.entries(slots)) {
			await dataSource.query('INSERT INTO "availability_slot" VALUES (?, ?, ?)', [id, startTime, endTime]);
		}
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	it('finds every stored slot overlapping the new one, and none that only touches it', async () => {
		const condition = sqliteOverlapCondition('availability_slot', iso('10:00'), iso('11:00'));
		const rows: { id: string }[] = await dataSource.query(
			`SELECT "id" FROM "availability_slot" WHERE ${condition} ORDER BY "id"`
		);

		expect(rows.map(({ id }) => id)).toEqual(['enclosing', 'inside', 'overlapsEnd', 'overlapsStart', 'same']);
	});
});
