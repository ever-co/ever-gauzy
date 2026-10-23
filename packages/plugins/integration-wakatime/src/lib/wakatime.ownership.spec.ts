import { ForbiddenException } from '@nestjs/common';
import { IUser } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { WakatimeController } from './wakatime.controller';
import { WakatimeService } from './wakatime.service';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: the heartbeat routes state no permission, and every heartbeat
 * was filed under no one (`employeeId: null`), so any signed-in member wrote into one pool that nobody could tell
 * apart. A heartbeat is now the caller's: it is filed under the employee of the signed-in user, never one the body
 * names, and a caller with no employee record is refused.
 */
describe('WakaTime heartbeats are filed under the caller', () => {
	// Both repositories capture what is written, so the tests hold whichever ORM (DB_ORM) the service was loaded with
	let written: Array<Record<string, unknown>>;
	let service: WakatimeService;

	const heartbeat = (overrides: Record<string, unknown> = {}) => ({
		type: 'file',
		time: 1729670400,
		entity: '/src/app.ts',
		project: 'gauzy',
		user_agent: 'wakatime/v1 (linux-x) go1 vscode/1.0 vscode-wakatime/1.0',
		...overrides
	});

	const signIn = (user: Partial<IUser> | null) => {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as IUser);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(user?.employeeId ?? null);
	};

	beforeEach(() => {
		written = [];
		const capture = (values: unknown) => {
			written.push(...(Array.isArray(values) ? values : [values]));
		};
		const builder = {
			insert: () => builder,
			values: (values: unknown) => (capture(values), builder),
			orIgnore: () => builder,
			execute: jest.fn().mockResolvedValue({ identifiers: [{}, {}] })
		};
		const knex = (_table: string) => ({
			insert: (values: unknown) => (capture(values), { onConflict: () => ({ ignore: async () => undefined }) })
		});
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new WakatimeService({ createQueryBuilder: () => builder } as any, { getKnex: () => knex } as any);
	});

	afterEach(() => jest.restoreAllMocks());

	it('files a heartbeat under the employee of the signed-in user', async () => {
		signIn({ id: 'user-a', employeeId: 'employee-a' });

		await service.parameterSanitize(heartbeat(), {});

		expect(written).toHaveLength(1);
		expect(written[0]).toMatchObject({ employeeId: 'employee-a', entities: '/src/app.ts' });
	});

	it('files every heartbeat of a bulk post under that employee, whatever the body says', async () => {
		signIn({ id: 'user-a', employeeId: 'employee-a' });

		await service.parameterSanitize([heartbeat({ employeeId: 'employee-b' }), heartbeat({ time: 1729670401 })], {});

		expect(written.map((row) => row.employeeId)).toEqual(['employee-a', 'employee-a']);
	});

	it('refuses a caller with no employee record, and writes nothing', () => {
		signIn({ id: 'admin-user' });

		expect(() => service.parameterSanitize(heartbeat(), {})).toThrow(ForbiddenException);
		expect(written).toEqual([]);
	});

	it('answers that refusal with 403 on the bulk route, not with a 400', async () => {
		signIn({ id: 'admin-user' });
		const controller = new WakatimeController(service);

		await expect(controller.saveData([heartbeat(), heartbeat({ time: 1729670401 })], {})).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(controller.save(heartbeat(), {})).rejects.toBeInstanceOf(ForbiddenException);
		expect(written).toEqual([]);
	});
});
