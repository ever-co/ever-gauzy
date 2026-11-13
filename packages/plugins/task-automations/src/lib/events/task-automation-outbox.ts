import { DataSource } from 'typeorm';
import { IOutboxWriteInput } from '@gauzy/contracts';
import { EventOutboxService, getORMType, MultiORMEnum } from '@gauzy/core';

/**
 * Appends an event through the ORM `DB_ORM` configures (under MikroORM the outbox's TypeORM entity maps its base
 * columns only, so the row must be written through MikroORM), in a transaction of its own: the outbox's commit hook
 * then wakes the dispatch pass at once. Shared by the captures (task changes, closed links).
 */
export async function appendToOutbox(outbox: EventOutboxService, dataSource: DataSource, input: IOutboxWriteInput): Promise<void> {
	if (getORMType() === MultiORMEnum.MikroORM) {
		const em = outbox.mikroOrmEventOutboxRepository?.getEntityManager?.();
		if (em) {
			await em.fork().transactional((transaction) => outbox.append(transaction as never, input));
			return;
		}
	}
	await dataSource.manager.transaction((manager) => outbox.append(manager, input));
}
