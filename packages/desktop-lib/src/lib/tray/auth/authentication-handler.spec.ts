/**
 * An organization switch in the timer waits for `AUTH_SUCCESS_SAVE`, which runs `handleAuthSuccess(arg,
 * { requireSavedUser: true })`: the offline timer, screenshots and sync read the employee of the saved user, so a user
 * that cannot be saved must reject it (the renderer then sends the user to sign in again), while the sign-in's
 * fire-and-forget `auth_success` keeps going on as before.
 */
jest.mock('@gauzy/desktop-core', () => ({ RegisteredWindow: { TIMER: 'timer' } }));
jest.mock('@gauzy/desktop-window', () => ({ getApiBaseUrl: () => 'http://localhost:3000' }));
jest.mock('../../app-window-manager', () => ({ AppWindowManager: { getInstance: () => ({}) } }));
jest.mock('../../offline', () => ({
	User: class {
		[key: string]: unknown;
		constructor(data: Record<string, unknown>) {
			Object.assign(this, data);
		}
		toObject() {
			return { ...this };
		}
	}
}));

import { AuthenticationHandler } from './authentication-handler';

describe('AuthenticationHandler', () => {
	const arg = {
		userId: 'user-1',
		organizationId: 'org-b',
		employeeId: 'employee-org-b',
		token: 'access-org-b',
		user: { id: 'user-1', employee: { id: 'employee-org-b', organizationId: 'org-b' } }
	};

	let userRepository: { save: jest.Mock; remove: jest.Mock };
	let configStore: { get: jest.Mock; set: jest.Mock; getStore: jest.Mock; updateConfigProject: jest.Mock };
	let handler: AuthenticationHandler;

	beforeEach(() => {
		userRepository = { save: jest.fn().mockResolvedValue(undefined), remove: jest.fn() };
		configStore = {
			get: jest.fn().mockReturnValue({ userId: 'user-1' }),
			set: jest.fn(),
			getStore: jest.fn().mockReturnValue({ isLocalServer: false }),
			updateConfigProject: jest.fn()
		};
		handler = new AuthenticationHandler(userRepository as any, configStore as any, {} as any, {});
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('saves the user with the employee of the organization switched to, then the auth store', async () => {
		await handler.handleAuthSuccess(arg, { requireSavedUser: true });

		expect(userRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ remoteId: 'user-1', organizationId: 'org-b', employee: arg.user.employee })
		);
		expect(configStore.set).toHaveBeenCalledWith({ auth: { ...arg, isLogout: false } });
	});

	it('rejects, before the auth store changes, when the user is required and cannot be saved', async () => {
		const failure = new Error('SQLITE_BUSY');
		userRepository.save.mockRejectedValue(failure);

		await expect(handler.handleAuthSuccess(arg, { requireSavedUser: true })).rejects.toBe(failure);

		expect(configStore.set).not.toHaveBeenCalled();
	});

	it('rejects when the user is required and has no employee to save', async () => {
		const withoutEmployee = { ...arg, employeeId: null, user: { id: 'user-1' } };

		await expect(handler.handleAuthSuccess(withoutEmployee, { requireSavedUser: true })).rejects.toThrow(
			'The account has no employee to save'
		);

		expect(userRepository.save).not.toHaveBeenCalled();
		expect(configStore.set).not.toHaveBeenCalled();
	});

	it('still goes on after a failed save for the sign-in, which does not require it', async () => {
		userRepository.save.mockRejectedValue(new Error('SQLITE_BUSY'));

		await expect(handler.handleAuthSuccess(arg)).resolves.toBeUndefined();

		expect(configStore.set).toHaveBeenCalledWith({ auth: { ...arg, isLogout: false } });
	});
});
