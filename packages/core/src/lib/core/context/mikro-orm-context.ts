import { MikroORM, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { getORMType, MultiORMEnum } from '../utils';

/**
 * Runs `work` in a MikroORM request context of its own, on a fresh fork of the global EntityManager, when this process
 * runs on MikroORM (DB_ORM=mikro-orm) and has its instance at hand; otherwise runs it as it is.
 *
 * MikroORM refuses its global EntityManager outside a request context ("Using global EntityManager instance methods
 * for context specific actions is disallowed"). A request gets its context from the API's middleware; a background
 * job (a queue's worker, an in-process timer, an outbox consumer) runs outside any request, so every repository call it
 * makes through MikroORM fails unless it opens one. Each call opens a new context: a job that wraps each unit of its
 * work (a reminder, a cart, a mapping) reads every unit afresh, as TypeORM does, rather than from an identity map
 * filled by the units before it.
 *
 * Under TypeORM, or without the MikroORM instance (`@Optional()` injection in a bare test wiring), `work` runs as is,
 * and nothing about it changes.
 *
 * @param orm The MikroORM instance of this process, when it has one.
 * @param work The work to run.
 * @returns What `work` returns.
 */
export function runInMikroOrmContext<T>(orm: MikroORM | null | undefined, work: () => Promise<T>): Promise<T> {
	if (orm && getORMType() === MultiORMEnum.MikroORM) {
		return MikroOrmRequestContext.create(orm.em, work);
	}
	return work();
}
