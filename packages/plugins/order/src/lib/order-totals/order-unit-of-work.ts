import { Injectable, Optional } from '@nestjs/common';
import { MikroORM, RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { MultiORMEnum, getORMType } from '@gauzy/core';

/**
 * A persistence context of its own for one unit of a pass that no request is behind.
 *
 * **Why the order package needs one.** The package's two scheduled passes — the totals reconciliation
 * and the stale-change sweep — run in `apps/worker`, fired by the scheduler with no HTTP request, and so
 * with none of the context a request brings. Under `DB_ORM=mikro-orm` that is not a detail: every
 * repository the platform's CRUD services hold is bound to MikroORM's *global* entity manager, and
 * MikroORM refuses context-specific work on it (`Using global EntityManager instance methods for
 * context specific actions is disallowed`). A request is given a fork by MikroORM's middleware; a
 * scheduled pass is given nothing, so its first read threw and both passes did nothing at all, every
 * time, on every MikroORM installation.
 *
 * `run` opens a MikroORM `RequestContext` — a fork of the global manager that every repository call
 * inside it resolves to — around the work it is handed. **It is opened per unit, not per pass**, and
 * that is the other half of the point: a fork has its own identity map and its own unit of work, so a
 * write that fails leaves its changes in *its* unit of work and not in one the next order would flush
 * again. One order's failure therefore stays that order's, and a pass over a week of orders does not
 * accumulate a week of managed entities in one map.
 *
 * Under TypeORM there is no such context to open — a repository call carries its own connection — so
 * `run` is the work itself and nothing about the TypeORM path changes.
 *
 * The same question — which ORM the installation reads through — decides where an order row is read
 * from, so it is answered here once: {@link usesMikroOrm}.
 */
@Injectable()
export class OrderUnitOfWork {
	constructor(@Optional() private readonly mikroOrm?: MikroORM) {}

	/**
	 * Whether the installation reads and writes through MikroORM.
	 *
	 * Both connections are opened whatever `DB_ORM` says, but only the configured one carries the full
	 * entity metadata: the kernel's column decorators apply one ORM's decorator, so under MikroORM the
	 * TypeORM entity for `order` has its base columns and nothing else. A read through the wrong one
	 * answers with a row that has no status, no currency and no tenant.
	 *
	 * @returns True when MikroORM is the configured ORM and its connection is available.
	 */
	get usesMikroOrm(): boolean {
		return getORMType() === MultiORMEnum.MikroORM && Boolean(this.mikroOrm);
	}

	/**
	 * Runs one unit of a request-less pass inside a persistence context of its own.
	 *
	 * @param work The unit: a read of one page, or the examination and repair of one order.
	 * @returns Whatever the work answers.
	 */
	public run<T>(work: () => Promise<T>): Promise<T> {
		if (!this.usesMikroOrm) {
			return work();
		}

		return MikroOrmRequestContext.create(this.mikroOrm.em, work);
	}
}

/**
 * Runs a unit through the context when there is one, and as itself when there is not.
 *
 * A service built without the context — a suite that constructs it by hand, a caller outside the
 * module — behaves exactly as it did before the context existed, which is the TypeORM behaviour.
 *
 * @param unitOfWork The context, when the container supplied one.
 * @param work The unit.
 * @returns Whatever the work answers.
 */
export function inOwnUnitOfWork<T>(unitOfWork: OrderUnitOfWork | undefined, work: () => Promise<T>): Promise<T> {
	return unitOfWork ? unitOfWork.run(work) : work();
}

/**
 * Splits a list into consecutive slices of at most `size` members.
 *
 * Used wherever a set of ids becomes an `IN (...)` list. Every member of such a list is a bound
 * parameter, and Postgres refuses a statement with more than 65,535 of them — so a set whose size
 * depends on how busy the installation was has to be read in slices, or the read that worked on a
 * quiet week fails outright on a busy one.
 *
 * @param items The list.
 * @param size The largest slice; anything below one is read as one.
 * @returns The slices, in order.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
	const step = Math.max(1, Math.floor(size));
	const slices: T[][] = [];

	for (let index = 0; index < items.length; index += step) {
		slices.push(items.slice(index, index + step));
	}

	return slices;
}
