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

/**
 * Runs `work` in a MikroORM request context of its own, on a fresh fork of the context in force, when this process
 * runs on MikroORM (DB_ORM=mikro-orm) and a context is in force; otherwise runs it as it is.
 *
 * For a unit of work that runs long after the context it was set up in, without the MikroORM instance at hand: an
 * event a subscription delivers runs in the async context the subscription was opened in (its stream, or a loop it
 * started, carries that context along), and so on the fork that context holds — one fork for every event of a stream
 * that may stay open for hours. Its identity map would then answer each later read with the entity an earlier event
 * loaded rather than with the row as it is now, and would grow with every event. A fork of that fork, opened for the
 * unit, keeps its filters and schema and starts with an empty identity map, so each event reads afresh, as each HTTP
 * request does.
 *
 * Without a context in force there is nothing to fork: `work` runs as it is, exactly as it would have. Under TypeORM no
 * context is ever looked for, and nothing about `work` changes.
 *
 * `work` is called synchronously either way: what it returns — a value or a promise — is returned as it is, and what
 * it throws is thrown, so wrapping a callback does not change how its caller sees it answer or fail.
 *
 * @param work The work to run.
 * @returns What `work` returns.
 */
export function runInFreshMikroOrmContext<T>(work: () => T): T {
	const em = getORMType() === MultiORMEnum.MikroORM ? MikroOrmRequestContext.getEntityManager() : undefined;
	if (em) {
		return MikroOrmRequestContext.create(em, work);
	}
	return work();
}
