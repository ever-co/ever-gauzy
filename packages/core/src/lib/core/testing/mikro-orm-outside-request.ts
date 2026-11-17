import { randomUUID } from 'node:crypto';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityManager, EntitySchema, MikroORM } from '@mikro-orm/core';

/** A row of the probe table: what a write through MikroORM needs, and nothing of the platform's. */
class MikroOrmProbe {
	id!: string;
}

const MIKRO_ORM_PROBE = new EntitySchema<MikroOrmProbe>({
	class: MikroOrmProbe,
	tableName: 'mikro_orm_probe',
	properties: { id: { type: 'string', primary: true } }
});

/** A MikroORM instance as a background job of the API meets it under DB_ORM=mikro-orm. */
export interface IMikroOrmOutsideRequest {
	/** The instance, as the API injects it (`MikroORM`). */
	orm: MikroORM;
	/**
	 * Writes a row through the global EntityManager, as a repository the platform injects does: refused outside a
	 * MikroORM request context, written on that context's own fork inside one.
	 *
	 * @returns The EntityManager the row was written through.
	 */
	write(): Promise<EntityManager>;
	/** How many rows were written. */
	rows(): Promise<number>;
	close(): Promise<void>;
}

/**
 * A MikroORM instance whose global EntityManager refuses every call that needs a context outside a MikroORM request
 * context (`allowGlobalContext: false`, MikroORM's default, which the API keeps under DB_ORM=mikro-orm). A queue's
 * worker, an in-process timer, anything that is not a request runs outside one: a job that writes through MikroORM
 * there fails as {@link IMikroOrmOutsideRequest.write} does.
 */
export async function mikroOrmOutsideRequest(): Promise<IMikroOrmOutsideRequest> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MIKRO_ORM_PROBE],
		allowGlobalContext: false,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.em.getConnection().execute('CREATE TABLE "mikro_orm_probe" ("id" text PRIMARY KEY NOT NULL)', [], 'run');
	return {
		orm,
		write: async () => {
			// What every call of an injected repository does first: refused on the global EntityManager outside a context
			const em = orm.em.getContext();
			em.persist(em.create(MikroOrmProbe, { id: randomUUID() }));
			await em.flush();
			return em as EntityManager;
		},
		rows: async () => {
			const [row] = await orm.em
				.getConnection()
				.execute<Array<{ count: number }>>('SELECT COUNT(*) AS "count" FROM "mikro_orm_probe"', [], 'all');
			return Number(row?.count ?? 0);
		},
		close: () => orm.close(true)
	};
}
