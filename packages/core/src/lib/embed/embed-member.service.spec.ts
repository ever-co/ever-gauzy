// Must stay first: loads the entity graph before the service pulls an entity (see user.create.handler.spec.ts).
import '../core/entities/internal';

import { ServiceUnavailableException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { EMBED_MEMBER_NAME_MAX_LENGTH, EmbedMemberService, newMemberOf } from './embed-member.service';

const TENANT = '7c000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = '7c000000-0000-4000-8000-00000000000b';
const ADDRESS = 'noor.haddad@fabrikam.example';

/** The service on a data source; its additions have their own spec on SQLite (`embed-member.service.sqlite.spec.ts`). */
const serviceOn = (dataSource: DataSource) => new EmbedMemberService(dataSource, {} as CommandBus);

describe('newMemberOf: the person an exchange body names, to add', () => {
	it('takes a valid address, trimmed and in the case it was sent, with the names of the body trimmed', () => {
		expect(
			newMemberOf({ email: ' Noor.Haddad@Fabrikam.example ', firstName: ' Noor ', lastName: ' Haddad ' })
		).toEqual({
			email: 'Noor.Haddad@Fabrikam.example',
			firstName: 'Noor',
			lastName: 'Haddad'
		});
	});

	it('names no one without a valid address', () => {
		const tooLong = `${'n'.repeat(64)}@${'f'.repeat(63)}.${'g'.repeat(63)}.${'h'.repeat(63)}.example`;
		for (const email of [
			undefined,
			null,
			42,
			{},
			'',
			'   ',
			'noor',
			'noor@',
			'@fabrikam.example',
			'noor haddad@x.example',
			tooLong
		]) {
			expect(newMemberOf({ email, firstName: 'Noor' })).toBeNull();
		}
	});

	it('takes no name that is blank or not a string, and cuts a long one', () => {
		const long = `${'N'.repeat(EMBED_MEMBER_NAME_MAX_LENGTH)}oor`;

		expect(newMemberOf({ email: ADDRESS, firstName: '   ', lastName: 7 })).toEqual({
			email: ADDRESS,
			firstName: undefined,
			lastName: undefined
		});
		expect(newMemberOf({ email: ADDRESS, firstName: long }).firstName).toBe(
			'N'.repeat(EMBED_MEMBER_NAME_MAX_LENGTH)
		);
	});
});

/** A promise and the function that settles it, to hold a work until the case lets it end. */
function gate() {
	let open: () => void = () => undefined;
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { opened, open };
}

/** Lets every pending callback run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** A data source of the type given whose query runners record what they are asked, in one list with the work. */
function dataSourceOf(type: string, options: { acquired?: number } = {}) {
	const steps: string[] = [];
	const parameters: unknown[][] = [];
	let isTransactionActive = false;
	const runner = {
		get isTransactionActive() {
			return isTransactionActive;
		},
		connect: jest.fn(async () => {
			steps.push('connect');
		}),
		startTransaction: jest.fn(async () => {
			isTransactionActive = true;
			steps.push('begin');
		}),
		commitTransaction: jest.fn(async () => {
			isTransactionActive = false;
			steps.push('commit');
		}),
		rollbackTransaction: jest.fn(async () => {
			isTransactionActive = false;
			steps.push('rollback');
		}),
		query: jest.fn(async (sql: string, values: unknown[] = []) => {
			steps.push(sql);
			parameters.push(values);
			const isLock = sql.includes('GET_LOCK');
			if (isLock) {
				return [{ acquired: options.acquired ?? 1 }];
			}
			return [];
		}),
		release: jest.fn(async () => {
			steps.push('release');
		})
	};
	const dataSource = { options: { type }, createQueryRunner: jest.fn(() => runner) } as unknown as DataSource;
	return { dataSource, runner, steps, parameters };
}

describe('EmbedMemberService: one addition of an address at a time', () => {
	it('runs a second turn of the same address of a tenant only once the first has ended, whatever its case', async () => {
		const service = serviceOn(dataSourceOf('better-sqlite3').dataSource);
		const steps: string[] = [];
		const first = gate();

		const firstTurn = service.inTurn(TENANT, ADDRESS, async () => {
			steps.push('first starts');
			await first.opened;
			steps.push('first ends');
			return 'first';
		});
		const secondTurn = service.inTurn(TENANT, ` ${ADDRESS.toUpperCase()} `, async () => {
			steps.push('second starts');
			return 'second';
		});
		await settle();
		expect(steps).toEqual(['first starts']);

		first.open();

		await expect(Promise.all([firstTurn, secondTurn])).resolves.toEqual(['first', 'second']);
		expect(steps).toEqual(['first starts', 'first ends', 'second starts']);
	});

	it('runs the turns of another address, or of the same address in another tenant, at the same time', async () => {
		const service = serviceOn(dataSourceOf('better-sqlite3').dataSource);
		const held = gate();
		const started: string[] = [];

		const holding = service.inTurn(TENANT, ADDRESS, async () => {
			await held.opened;
		});
		const otherAddress = service.inTurn(TENANT, 'lina@northwind.example', async () => {
			started.push('other address');
		});
		const otherTenant = service.inTurn(OTHER_TENANT, ADDRESS, async () => {
			started.push('other tenant');
		});
		await Promise.all([otherAddress, otherTenant]);

		expect(started).toEqual(['other address', 'other tenant']);
		held.open();
		await holding;
	});

	it('gives the turn to the next one when a turn fails', async () => {
		const service = serviceOn(dataSourceOf('better-sqlite3').dataSource);

		const failing = service.inTurn(TENANT, ADDRESS, async () => {
			throw new Error('the database went away');
		});
		const next = service.inTurn(TENANT, ADDRESS, async () => 'added');

		await expect(failing).rejects.toThrow('the database went away');
		await expect(next).resolves.toBe('added');
	});

	it('opens no connection of its own on SQLite, which runs one API process', async () => {
		const { dataSource } = dataSourceOf('better-sqlite3');
		const service = serviceOn(dataSource);

		await service.inTurn(TENANT, ADDRESS, async () => undefined);

		expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
	});
});

describe('EmbedMemberService: the database lock of an addition', () => {
	const LOCK_NAME = /^gauzy:embed-member:[0-9a-f]{32}$/;

	it('holds a transaction-scoped advisory lock on Postgres while the work runs, then ends the transaction', async () => {
		const { dataSource, steps, parameters } = dataSourceOf('postgres');
		const service = serviceOn(dataSource);

		const answer = await service.inTurn(TENANT, ADDRESS, async () => {
			steps.push('work');
			return 'added';
		});

		expect(answer).toBe('added');
		expect(steps).toEqual([
			'connect',
			'begin',
			'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
			'work',
			'commit',
			'release'
		]);
		const [name] = parameters[0] as string[];
		expect(name).toMatch(LOCK_NAME);
		expect(name).not.toContain('noor');
	});

	it('names the lock after the tenant and the address in lower case', async () => {
		const names: unknown[] = [];
		for (const [tenantId, email] of [
			[TENANT, ADDRESS],
			[TENANT, 'Noor.Haddad@Fabrikam.example'],
			[OTHER_TENANT, ADDRESS]
		]) {
			const { dataSource, parameters } = dataSourceOf('postgres');
			await serviceOn(dataSource).inTurn(tenantId, email, async () => undefined);
			names.push(parameters[0][0]);
		}

		expect(names[0]).toBe(names[1]);
		expect(names[2]).not.toBe(names[0]);
	});

	it('ends the transaction, and so the lock, when the work fails on Postgres', async () => {
		const { dataSource, steps } = dataSourceOf('postgres');
		const service = serviceOn(dataSource);

		await expect(
			service.inTurn(TENANT, ADDRESS, async () => {
				throw new Error('could not add');
			})
		).rejects.toThrow('could not add');

		expect(steps.slice(-2)).toEqual(['rollback', 'release']);
	});

	it('holds a named lock MySQL accepts while the work runs, then releases it', async () => {
		const { dataSource, steps, parameters } = dataSourceOf('mysql');
		const service = serviceOn(dataSource);

		await service.inTurn(TENANT, ADDRESS, async () => {
			steps.push('work');
		});

		expect(steps).toEqual([
			'connect',
			'SELECT GET_LOCK(?, ?) AS `acquired`',
			'work',
			'SELECT RELEASE_LOCK(?)',
			'release'
		]);
		const [name, seconds] = parameters[0] as [string, number];
		expect(name).toMatch(LOCK_NAME);
		expect(name.length).toBeLessThanOrEqual(64);
		expect(seconds).toBe(10);
		expect(parameters[1]).toEqual([name]);
	});

	it('answers 503 without running the work when MySQL does not give the lock in time', async () => {
		const { dataSource, steps } = dataSourceOf('mysql', { acquired: 0 });
		const service = serviceOn(dataSource);
		const work = jest.fn(async () => undefined);

		await expect(service.inTurn(TENANT, ADDRESS, work)).rejects.toThrow(ServiceUnavailableException);

		expect(work).not.toHaveBeenCalled();
		expect(steps).toEqual(['connect', 'SELECT GET_LOCK(?, ?) AS `acquired`', 'release']);
	});
});
