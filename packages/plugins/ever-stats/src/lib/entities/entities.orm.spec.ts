import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { DataSource } from 'typeorm';
import { EverInstanceEvents, EverInstanceService } from '@gauzy/plugin-ever-instance';
import { EverStatsStore } from '../ever-stats.store';
import { EVER_STATS_ENTITIES } from './index';

/**
 * Gauzy registers plugin entities with BOTH ORMs at boot, whichever one `DB_ORM` selects, and each
 * refuses an entity it cannot map (MikroORM: "entity is missing @PrimaryKey()"). These checks run
 * the same discovery as the API, so an entity that would stop the API from booting fails here.
 */
describe('the plugin entities load in both ORMs', () => {
	it('MikroORM discovers them (the API boots)', async () => {
		const orm = await MikroORM.init({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: EVER_STATS_ENTITIES,
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		expect(orm.getMetadata().getAll()).toBeDefined();
		await orm.close(true);
	});

	it('TypeORM maps them to the columns the migrations create (synchronize, then the plugin SQL works)', async () => {
		const dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: EVER_STATS_ENTITIES, synchronize: true });
		await dataSource.initialize();
		try {
			const instance = new EverInstanceService(dataSource, new EverInstanceEvents(), { JWT_SECRET: 'x' });
			const record = await instance.ensure();
			expect(record.statsEnabledUi).toBe(true);
			const store = new EverStatsStore(dataSource);
			expect(await store.acquireLease('me', Date.now(), 60_000)).toBe(true);
			await store.insertReport({
				id: 'r1',
				period: '2026-10',
				payload: '{}',
				status: 'sent',
				httpStatus: 202,
				attempts: 1,
				lastError: null,
				sentAt: 1,
				createdAt: 1
			});
			expect((await store.latest())[0].id).toBe('r1');
		} finally {
			await dataSource.destroy();
		}
	});
});
