import { Logger, RequestTimeoutException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { isUniqueViolation } from '../../core/errors/unique-violation';

/** The table that holds the employees' timer turns every API process shares (one row per employee holding one). */
export const EMPLOYEE_TIMER_TURN_TABLE = 'employee_timer_turn';

/**
 * Where the employees' timer turns are kept, shared by every API process. A turn is a lease: a row naming the employee,
 * its holder and when it ends. Each call is one short statement: no connection is held between them, nor while a
 * start or a stop waits for a turn.
 */
export interface TimerTurnStore {
	/**
	 * Removes the employee's turn when it ended before `now`: its holder hung or its process stopped.
	 *
	 * @param employeeId The employee.
	 * @param now The time, in milliseconds since the epoch.
	 */
	dropEnded(employeeId: ID, now: number): Promise<void>;

	/**
	 * Takes the employee's turn for `holder` until `endsAt`.
	 *
	 * @returns True when taken, false when another holder has it.
	 */
	tryTake(employeeId: ID, holder: string, endsAt: number): Promise<boolean>;

	/** Gives the employee's turn back, when `holder` still has it. */
	giveBack(employeeId: ID, holder: string): Promise<void>;
}

/** The store on the database, through TypeORM's connection, which the API opens whichever ORM it runs with. */
export class SqlTimerTurnStore implements TimerTurnStore {
	constructor(private readonly manager: EntityManager) {}

	async dropEnded(employeeId: ID, now: number): Promise<void> {
		await this.manager
			.createQueryBuilder()
			.delete()
			.from(EMPLOYEE_TIMER_TURN_TABLE)
			.where(p(`"employeeId" = :employeeId AND "endsAt" < :now`), { employeeId, now })
			.execute();
	}

	async tryTake(employeeId: ID, holder: string, endsAt: number): Promise<boolean> {
		try {
			await this.manager
				.createQueryBuilder()
				.insert()
				.into(EMPLOYEE_TIMER_TURN_TABLE, ['employeeId', 'holder', 'endsAt'])
				.values({ employeeId, holder, endsAt })
				.execute();
			return true;
		} catch (error) {
			if (isUniqueViolation(error) || isUniqueViolation((error as { driverError?: unknown })?.driverError)) {
				return false;
			}
			throw error;
		}
	}

	async giveBack(employeeId: ID, holder: string): Promise<void> {
		await this.manager
			.createQueryBuilder()
			.delete()
			.from(EMPLOYEE_TIMER_TURN_TABLE)
			.where(p(`"employeeId" = :employeeId AND "holder" = :holder`), { employeeId, holder })
			.execute();
	}
}

/** The employee's turn as one start or stop holds it in the store. */
export interface HeldTimerTurn {
	/**
	 * Whether the turn is still this one's: until shortly before it ends, as another API process takes an ended turn
	 * over. Always true for a turn the store could not keep (see {@link takeTimerTurn}).
	 */
	isHeld(): boolean;

	/** Gives the turn back; never throws. */
	giveBack(): Promise<void>;
}

/** What a start or stop needs to take the employee's turn in the store. */
export interface TimerTurnOptions {
	/** How long a turn lasts once taken, in milliseconds. */
	readonly lengthMs: number;
	/** How long to wait for a turn another holder has, in milliseconds, before the start or stop is refused. */
	readonly waitMs: number;
	/** The pause between two tries, in milliseconds. */
	readonly retryMs: number;
	/** The part of its length a holder gives up early, against clocks that drift between API processes. */
	readonly marginMs: number;
	/** The clock, in milliseconds since the epoch. */
	readonly now: () => number;
	/** Waits `ms` milliseconds. */
	readonly sleep: (ms: number) => Promise<void>;
}

const logger = new Logger('EmployeeTimerTurn');

/** A turn held without the store: the store failed, and the start or stop goes on as it did before the store. */
const UNKEPT_TURN: HeldTimerTurn = {
	isHeld: () => true,
	giveBack: async () => undefined
};

/**
 * Takes the employee's timer turn in the store every API process shares, waiting while another start or stop has it.
 * The turn ends on its own `lengthMs` after it was taken, so a process that stops or hangs holds the employee's timer
 * that long at most: the next one then takes it over.
 *
 * When the store fails (a database error, a table not migrated yet), the start or stop goes on without a turn, as it
 * did before the store existed: a timer never stops working because of the store.
 *
 * When the turn stays taken past `waitMs`, the start or stop is refused and runs nothing. A turn one holder took ends
 * after `lengthMs`, which the wait covers, so the wait only runs out while the turn keeps passing to other starts or
 * stops of the employee, or while a holder whose clock runs ahead of this one keeps it: going on then would run beside
 * a start or stop that still holds the turn, which is what the turn is there to prevent.
 *
 * @param store The shared store.
 * @param employeeId The employee whose timer starts or stops.
 * @param options The lengths and clock.
 * @returns The turn held, to give back once the start or stop has settled.
 * @throws RequestTimeoutException when the turn stayed taken for `waitMs`.
 */
export async function takeTimerTurn(
	store: TimerTurnStore,
	employeeId: ID,
	options: TimerTurnOptions
): Promise<HeldTimerTurn> {
	const holder = randomUUID();
	const waitUntil = options.now() + options.waitMs;
	while (true) {
		const now = options.now();
		const endsAt = now + options.lengthMs;
		let isTaken: boolean;
		try {
			await store.dropEnded(employeeId, now);
			isTaken = await store.tryTake(employeeId, holder, endsAt);
		} catch (error) {
			logger.warn(
				`The timer turns could not be read or written; the start or stop of employee ${employeeId} goes on without one: ${
					(error as Error)?.message
				}`
			);
			return UNKEPT_TURN;
		}
		if (isTaken) {
			return heldTurn(store, employeeId, holder, endsAt, options);
		}
		if (options.now() >= waitUntil) {
			logger.warn(
				`The timer turn of employee ${employeeId} stayed taken for ${options.waitMs} ms: this start or stop is refused.`
			);
			throw new RequestTimeoutException(
				'Another start or stop of your timer is still going on. Try again in a moment.'
			);
		}
		await options.sleep(options.retryMs);
	}
}

/** The turn `holder` took until `endsAt`. */
function heldTurn(
	store: TimerTurnStore,
	employeeId: ID,
	holder: string,
	endsAt: number,
	options: TimerTurnOptions
): HeldTimerTurn {
	return {
		isHeld: () => options.now() < endsAt - options.marginMs,
		giveBack: async () => {
			try {
				await store.giveBack(employeeId, holder);
			} catch (error) {
				logger.warn(
					`The timer turn of employee ${employeeId} could not be given back; it ends on its own: ${
						(error as Error)?.message
					}`
				);
			}
		}
	};
}
