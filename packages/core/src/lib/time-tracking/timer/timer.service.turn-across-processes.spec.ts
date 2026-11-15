// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { RequestTimeoutException } from '@nestjs/common';
import { EMPLOYEE_TURN_FAILSAFE_MS, EmployeeTurn, TimerService } from './timer.service';
import { takeTimerTurn, TimerTurnOptions, TimerTurnStore } from './employee-timer-turn';

const EMPLOYEE_ID = '11826000-0000-4000-8000-0000000000e1';

/** The turns as the shared table holds them, in memory: one row per employee. */
function memoryStore(): TimerTurnStore & { rows: Map<string, { holder: string; endsAt: number }> } {
	const rows = new Map<string, { holder: string; endsAt: number }>();
	return {
		rows,
		dropEnded: async (employeeId, now) => {
			if ((rows.get(employeeId)?.endsAt ?? Infinity) < now) {
				rows.delete(employeeId);
			}
		},
		tryTake: async (employeeId, holder, endsAt) => {
			if (rows.has(employeeId)) {
				return false;
			}
			rows.set(employeeId, { holder, endsAt });
			return true;
		},
		giveBack: async (employeeId, holder) => {
			if (rows.get(employeeId)?.holder === holder) {
				rows.delete(employeeId);
			}
		}
	};
}

/** How the other API process takes its turn, as a start or stop does. */
const OTHER_PROCESS_TURN: TimerTurnOptions = {
	lengthMs: 120_000,
	waitMs: 120_000,
	retryMs: 100,
	marginMs: 5_000,
	now: () => Date.now(),
	sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A stop reaching one API process while a start reached another closed the new run at once: the order of an employee's
 * starts and stops was kept within each process only (ever-co/ever-gauzy#11826). Each one now also holds the
 * employee's turn in the store every process shares.
 */
describe('TimerService — the turn every API process shares', () => {
	let service: TimerService;
	let store: ReturnType<typeof memoryStore>;

	/** The service's turn runner, as a start or a stop calls it. */
	const inEmployeeTurn = <T>(work: (turn: EmployeeTurn) => Promise<T>): Promise<T> =>
		(
			service as unknown as {
				inEmployeeTurn: (employeeId: string, work: (turn: EmployeeTurn) => Promise<T>) => Promise<T>;
			}
		).inEmployeeTurn(EMPLOYEE_ID, work);

	beforeEach(() => {
		store = memoryStore();
		service = Object.create(TimerService.prototype);
		Object.assign(service, {
			logger: { debug: jest.fn(), warn: jest.fn(), log: jest.fn() },
			timerTurnStore: () => store
		});
	});

	it("waits while another API process holds the employee's turn, then holds it and gives it back", async () => {
		// A start or stop of the same employee, going on in another API process
		const otherProcess = await takeTimerTurn(store, EMPLOYEE_ID, OTHER_PROCESS_TURN);
		const order: string[] = [];

		const running = inEmployeeTurn(async (turn) => {
			order.push('this one');
			expect(turn.isHeld()).toBe(true);
			expect(store.rows.size).toBe(1);
		});
		await pause(350);
		expect(order).toEqual([]);

		order.push('the other one settles');
		await otherProcess.giveBack();
		await running;

		expect(order).toEqual(['the other one settles', 'this one']);
		expect(store.rows.size).toBe(0);
	});

	it('gives the turn back when the start or stop fails', async () => {
		await expect(
			inEmployeeTurn(async () => {
				expect(store.rows.size).toBe(1);
				throw new Error('The database refused the write');
			})
		).rejects.toThrow('The database refused the write');

		expect(store.rows.size).toBe(0);
	});

	it('goes on in this process order alone when the turns cannot be read or written', async () => {
		Object.assign(service, {
			timerTurnStore: (): TimerTurnStore => ({
				dropEnded: async () => {
					throw new Error('relation "employee_timer_turn" does not exist');
				},
				tryTake: async () => true,
				giveBack: async () => undefined
			})
		});

		await expect(inEmployeeTurn(async (turn) => turn.isHeld())).resolves.toBe(true);
	});

	describe('with the clock mocked', () => {
		beforeEach(() => {
			// The timers and the clock: the polls of a wait for the shared turn sleep on them
			jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
		});
		afterEach(() => {
			jest.useRealTimers();
		});

		it('gives a start or stop its whole failsafe time once it holds the shared turn, however long it waited for it', async () => {
			// Another API process holds the turn for 110 s
			const otherProcess = await takeTimerTurn(store, EMPLOYEE_ID, OTHER_PROCESS_TURN);
			setTimeout(() => void otherProcess.giveBack(), 110_000);
			let firstTurn: EmployeeTurn | undefined;
			let finishFirst: () => void = () => undefined;
			const order: string[] = [];

			const first = inEmployeeTurn((turn) => {
				firstTurn = turn;
				return new Promise<void>((resolve) => (finishFirst = resolve));
			});
			const second = inEmployeeTurn(async () => {
				order.push('second');
			});
			await jest.advanceTimersByTimeAsync(130_000);

			// Twenty seconds into its run, the first still holds its turn, and the next one in this process waits
			expect(firstTurn?.isHeld()).toBe(true);
			expect(order).toEqual([]);

			finishFirst();
			await first;
			await second;
			expect(order).toEqual(['second']);
			expect(store.rows.size).toBe(0);
		});

		it('refuses with a 408, and runs nothing, a start or stop whose shared turn stayed taken as long as it waits', async () => {
			// A holder whose turn outlasts the wait: a process whose clock runs ahead
			await takeTimerTurn(store, EMPLOYEE_ID, { ...OTHER_PROCESS_TURN, lengthMs: 600_000 });
			const work = jest.fn(async () => 'ran');

			const outcome = inEmployeeTurn(work).catch((error: unknown) => error);
			await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS + 1_000);

			await expect(outcome).resolves.toBeInstanceOf(RequestTimeoutException);
			expect(work).not.toHaveBeenCalled();
			// The holder keeps its turn
			expect(store.rows.size).toBe(1);
		});
	});
});
