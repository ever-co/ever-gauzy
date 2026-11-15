import { DataSource } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { CreateEmployeeTimerTurnTable1791000012100 } from '../../database/migrations/1791000012100-CreateEmployeeTimerTurnTable';
import { SqlTimerTurnStore, takeTimerTurn, TimerTurnOptions, TimerTurnStore } from './employee-timer-turn';

const EMPLOYEE = '11826000-0000-4000-8000-000000000001';
const OTHER_EMPLOYEE = '11826000-0000-4000-8000-000000000002';

/** A clock the specs move: each wait moves it forward, as time passes while a start or stop waits. */
function fakeClock(start = 1_000_000) {
	let now = start;
	const waits: number[] = [];
	return {
		now: () => now,
		advance: (ms: number) => {
			now += ms;
		},
		waits,
		sleep: async (ms: number) => {
			waits.push(ms);
			now += ms;
		}
	};
}

/** The turns as the table holds them, in memory, with the same rules: one row per employee. */
function memoryStore(): TimerTurnStore & { rows: Map<string, { holder: string; endsAt: number }> } {
	const rows = new Map<string, { holder: string; endsAt: number }>();
	return {
		rows,
		dropEnded: async (employeeId, now) => {
			const row = rows.get(employeeId);
			if (row && row.endsAt < now) {
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

/**
 * A start and a stop of one employee's timer took turns within one API process only, so a stop reaching one process
 * while a start reached another closed the new run at once (ever-co/ever-gauzy#11826). They now take the employee's
 * turn in a table every process shares.
 */
describe('takeTimerTurn', () => {
	const optionsOf = (
		clock: ReturnType<typeof fakeClock>,
		overrides: Partial<TimerTurnOptions> = {}
	): TimerTurnOptions => ({
		lengthMs: 120_000,
		waitMs: 120_000,
		retryMs: 100,
		marginMs: 5_000,
		now: clock.now,
		sleep: clock.sleep,
		...overrides
	});

	it('takes a free turn, holds it, and gives it back', async () => {
		const clock = fakeClock();
		const store = memoryStore();

		const turn = await takeTimerTurn(store, EMPLOYEE, optionsOf(clock));

		expect(turn.isHeld()).toBe(true);
		expect(store.rows.get(EMPLOYEE)?.endsAt).toBe(clock.now() + 120_000);
		await turn.giveBack();
		expect(store.rows.has(EMPLOYEE)).toBe(false);
	});

	it("waits while another API process holds the employee's turn, and takes it once given back", async () => {
		const clock = fakeClock();
		const store = memoryStore();
		const other = await takeTimerTurn(store, EMPLOYEE, optionsOf(clock));
		// The other process settles while this one waits its third pause
		const sleep = async (ms: number) => {
			await clock.sleep(ms);
			if (clock.waits.length === 3) {
				await other.giveBack();
			}
		};

		const turn = await takeTimerTurn(store, EMPLOYEE, optionsOf(clock, { sleep }));

		expect(clock.waits).toEqual([100, 100, 100]);
		expect(turn.isHeld()).toBe(true);
		expect(store.rows.size).toBe(1);
	});

	it("never waits on another employee's turn", async () => {
		const clock = fakeClock();
		const store = memoryStore();
		await takeTimerTurn(store, OTHER_EMPLOYEE, optionsOf(clock));

		await takeTimerTurn(store, EMPLOYEE, optionsOf(clock));

		expect(clock.waits).toEqual([]);
		expect(store.rows.size).toBe(2);
	});

	it('takes over a turn whose holder hung past its end, which then holds it no more', async () => {
		const clock = fakeClock();
		const store = memoryStore();
		const hung = await takeTimerTurn(store, EMPLOYEE, optionsOf(clock));

		clock.advance(115_000);
		expect(hung.isHeld()).toBe(false);

		clock.advance(5_001);
		const next = await takeTimerTurn(store, EMPLOYEE, optionsOf(clock));
		expect(next.isHeld()).toBe(true);

		// The hung one giving back late leaves the next one's turn alone
		await hung.giveBack();
		expect(store.rows.get(EMPLOYEE)).toBeDefined();
	});

	it('goes on without a turn once it waited as long as it may', async () => {
		const clock = fakeClock();
		const store = memoryStore();
		// A holder whose turn outlasts the wait: a process whose clock runs behind
		await takeTimerTurn(store, EMPLOYEE, optionsOf(clock, { lengthMs: 600_000 }));

		const turn = await takeTimerTurn(store, EMPLOYEE, optionsOf(clock, { waitMs: 1_000 }));

		expect(clock.waits).toHaveLength(10);
		expect(turn.isHeld()).toBe(true);
	});

	it('goes on as before when the turns cannot be read or written, and never throws', async () => {
		const clock = fakeClock();
		const failing: TimerTurnStore = {
			dropEnded: async () => {
				throw new Error('relation "employee_timer_turn" does not exist');
			},
			tryTake: async () => true,
			giveBack: async () => {
				throw new Error('connection lost');
			}
		};

		const turn = await takeTimerTurn(failing, EMPLOYEE, optionsOf(clock));

		expect(turn.isHeld()).toBe(true);
		await expect(turn.giveBack()).resolves.toBeUndefined();
	});
});

(isPostgres() ? describe.skip : describe)('SqlTimerTurnStore on SQLite, with its migration', () => {
	let dataSource: DataSource;
	const migration = new CreateEmployeeTimerTurnTable1791000012100();

	const runMigration = async (step: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[step](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const tableExists = async () => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			return await queryRunner.hasTable('employee_timer_turn');
		} finally {
			await queryRunner.release();
		}
	};

	beforeAll(async () => {
		dataSource = new DataSource({ type: 'better-sqlite3', database: ':memory:', entities: [], logging: false });
		await dataSource.initialize();
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('lets one holder take the turn, takes an ended one over, and gives back only its own', async () => {
		await runMigration('up');
		// Running it again changes nothing
		await runMigration('up');
		const store = new SqlTimerTurnStore(dataSource.manager);

		expect(await store.tryTake(EMPLOYEE, 'holder-a', 2_000)).toBe(true);
		expect(await store.tryTake(EMPLOYEE, 'holder-b', 3_000)).toBe(false);
		expect(await store.tryTake(OTHER_EMPLOYEE, 'holder-b', 3_000)).toBe(true);

		// Not ended yet: kept
		await store.dropEnded(EMPLOYEE, 1_999);
		expect(await store.tryTake(EMPLOYEE, 'holder-b', 3_000)).toBe(false);

		// Another holder giving back leaves it
		await store.giveBack(EMPLOYEE, 'holder-b');
		expect(await store.tryTake(EMPLOYEE, 'holder-b', 3_000)).toBe(false);

		// Ended: the next one takes it over
		await store.dropEnded(EMPLOYEE, 2_001);
		expect(await store.tryTake(EMPLOYEE, 'holder-b', 3_000)).toBe(true);

		await store.giveBack(EMPLOYEE, 'holder-b');
		expect(await store.tryTake(EMPLOYEE, 'holder-c', 4_000)).toBe(true);
	});

	it('drops the table on down, and builds it again on up', async () => {
		await runMigration('down');
		expect(await tableExists()).toBe(false);

		await runMigration('up');
		expect(await tableExists()).toBe(true);
	});
});
