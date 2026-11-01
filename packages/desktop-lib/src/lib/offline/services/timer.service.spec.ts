const timerDao = { update: jest.fn() };

// The local database and the Electron store cannot run here: the service is cut from them.
jest.mock('electron', () => ({ app: { getPath: () => '', getVersion: () => '0.0.0' }, shell: {} }), { virtual: true });
jest.mock('@sentry/electron/main', () => ({ captureException: jest.fn() }), { virtual: true });
jest.mock('../../desktop-store', () => ({ LocalStore: { getStore: jest.fn() } }));
jest.mock('../databases', () => ({ ProviderFactory: { instance: {} } }));
jest.mock('../dao/timer.dao', () => ({ TimerDAO: jest.fn(() => timerDao) }));
jest.mock('./user.service', () => ({ UserService: jest.fn(() => ({ retrieve: jest.fn() })) }));

import { Timer } from '../models/timer.model';
import { TimerService } from './timer.service';

/**
 * "Empty .update() call detected!" on timer start (#7811): `Timer.toObject()` lists all 19 fields, the unset ones as
 * `undefined`, so the old guard (counting keys) never stopped an update with nothing to write and Knex threw on it.
 * The service now writes only the fields that are set, and skips the update when none is.
 */
describe('TimerService.update', () => {
	let service: TimerService;
	let error: jest.SpyInstance;

	beforeEach(() => {
		timerDao.update.mockReset();
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		service = new TimerService();
	});

	afterEach(() => error.mockRestore());

	it('does not reach the database for a timer with nothing set but its id', async () => {
		await service.update(new Timer({ id: 1 } as never));

		expect(timerDao.update).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith(expect.stringContaining('No timer data want to update'));
	});

	it('does not reach the database when every field it sets is undefined', async () => {
		await service.update(new Timer({ id: 1, timelogId: undefined, timesheetId: undefined } as never));

		expect(timerDao.update).not.toHaveBeenCalled();
	});

	it('writes only the fields that are set', async () => {
		const startedAt = new Date('2026-10-31T08:00:00Z');

		await service.update(new Timer({ id: 1, startedAt, synced: false, isStartedOffline: false } as never));

		expect(timerDao.update).toHaveBeenCalledWith(1, { startedAt, synced: false, isStartedOffline: false });
	});

	it('keeps null values: they clear a column', async () => {
		await service.update(new Timer({ id: 2, timelogId: null } as never));

		expect(timerDao.update).toHaveBeenCalledWith(2, { timelogId: null });
	});

	it('accepts a plain object as well as a Timer', async () => {
		await service.update({ id: 3, duration: 60, projectId: undefined } as never);

		expect(timerDao.update).toHaveBeenCalledWith(3, { duration: 60 });
	});

	it('still refuses a timer without id', async () => {
		await service.update(new Timer({ duration: 60 } as never));

		expect(timerDao.update).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith(expect.stringContaining('cannot update'));
	});
});
