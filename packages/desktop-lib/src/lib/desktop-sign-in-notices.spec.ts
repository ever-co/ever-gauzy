/**
 * Owner decision 8 (2026-10-22): every desktop app that runs the API locally replaces the
 * `admin/admin` seed with random passwords generated for that install, shown once and changeable.
 *
 * Electron cannot run here, so its dialog and clipboard are mocked, and the electron-store is a Map
 * that survives `jest.resetModules()` the way the store file survives an app restart.
 */
const mockStore = new Map<string, unknown>();
const mockShowMessageBox = jest.fn();
const mockWriteText = jest.fn();

jest.mock(
	'electron',
	() => ({
		dialog: { showMessageBox: (...args: unknown[]) => mockShowMessageBox(...args) },
		clipboard: { writeText: (...args: unknown[]) => mockWriteText(...args) },
		BrowserWindow: class {}
	}),
	{ virtual: true }
);
jest.mock('@gauzy/desktop-core', () => ({
	store: {
		get: (key: string) => mockStore.get(key),
		// A copy, as electron-store writes JSON to disk.
		set: (key: string, value: unknown) => mockStore.set(key, JSON.parse(JSON.stringify(value))),
		delete: (key: string) => mockStore.delete(key)
	}
}));
jest.mock('./translation', () => ({ TranslateService: { instant: jest.fn((key: string) => key) } }));

import { desktopSeedCredentialsToEnv, DESKTOP_SEED_CREDENTIALS_STORE_KEY } from './config/desktop-seed-credentials';
import type { DesktopSignInNotices as Notices } from './desktop-sign-in-notices';

describe('DesktopSignInNotices', () => {
	let notices: typeof Notices;

	/** A fresh app process: module state is lost, the store file is not. */
	const restartApp = () => {
		jest.resetModules();
		notices = require('./desktop-sign-in-notices').DesktopSignInNotices;
	};

	/** The options of the n-th message box (called without a window, so they come first). */
	const dialogOptions = (call = 0) => {
		const args = mockShowMessageBox.mock.calls[call];
		return args[args.length - 1];
	};

	beforeEach(() => {
		mockStore.clear();
		mockShowMessageBox.mockReset();
		mockWriteText.mockReset();
		restartApp();
	});

	/**
	 * What a launcher does before the start, then the API seeding a new database with that env and
	 * reporting its default accounts' emails (`Database Default Seed Accounts:`).
	 */
	const startAndSeed = (inherited: Record<string, string> = {}) => {
		const credentials = notices.provisionSeedCredentials();
		const env = { ...inherited, ...desktopSeedCredentialsToEnv(credentials, inherited) };
		notices.recordSeed(env, {
			superAdmin: 'admin@ever.co',
			admin: 'local.admin@ever.co',
			employee: 'employee@ever.co'
		});
		return credentials;
	};

	it('CONTROL: an install whose API did not seed anything shows nothing', async () => {
		notices.provisionSeedCredentials();

		await notices.show();

		expect(mockShowMessageBox).not.toHaveBeenCalled();
		// The passwords wait in the store for a seed; none of them is a published default.
		const stored = mockStore.get(DESKTOP_SEED_CREDENTIALS_STORE_KEY) as Record<string, string>;
		expect(stored.superAdmin).toMatch(/^[A-Za-z0-9_-]{24}$/);
		expect(stored.pending).toBeUndefined();
	});

	it('after a seed, shows every generated password once, then forgets them', async () => {
		const credentials = startAndSeed();
		mockShowMessageBox.mockResolvedValueOnce({ response: 1 });

		await notices.show();

		expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
		const options = dialogOptions();
		expect(options.message).toBe('Save these passwords now. They are shown only once.');
		for (const text of [
			'Super Admin: admin@ever.co',
			`Password: ${credentials.superAdmin}`,
			'Admin: local.admin@ever.co',
			`Password: ${credentials.admin}`,
			'Employee: employee@ever.co',
			`Password: ${credentials.employee}`
		]) {
			expect(options.detail).toContain(text);
		}
		expect(options.detail).not.toMatch(/\badmin\b \/ admin|12345678/);
		expect(options.buttons).toEqual(['Copy', 'I have saved them']);
		// Escape does not dismiss it: it means "Copy".
		expect(options.cancelId).toBe(0);

		// Confirmed: no copy is kept, and nothing is shown again.
		expect(mockStore.has(DESKTOP_SEED_CREDENTIALS_STORE_KEY)).toBe(false);
		await notices.show();
		expect(mockShowMessageBox).toHaveBeenCalledTimes(1);

		// The next start provisions new passwords for a future seed (an emptied database).
		expect(notices.provisionSeedCredentials().superAdmin).not.toBe(credentials.superAdmin);
	});

	it('Copy (or Escape) copies them and shows the dialog again; only the confirmation forgets them', async () => {
		const credentials = startAndSeed();
		mockShowMessageBox
			.mockResolvedValueOnce({ response: 0 })
			.mockResolvedValueOnce({ response: 0 })
			.mockResolvedValueOnce({ response: 1 });

		await notices.show();

		expect(mockShowMessageBox).toHaveBeenCalledTimes(3);
		expect(mockWriteText).toHaveBeenCalledTimes(2);
		expect(mockWriteText.mock.calls[0][0]).toContain(credentials.superAdmin);
		expect(dialogOptions(0).detail).not.toContain('Copied to the clipboard.');
		expect(dialogOptions(1).detail).toContain('Copied to the clipboard.');
		expect(mockStore.has(DESKTOP_SEED_CREDENTIALS_STORE_KEY)).toBe(false);
	});

	it('a dialog never confirmed (the app was closed) comes back at the next start', async () => {
		const credentials = startAndSeed();

		restartApp();
		mockShowMessageBox.mockResolvedValueOnce({ response: 1 });
		// The launcher provisions again before starting the API: the seeded passwords are kept.
		expect(notices.provisionSeedCredentials()).toMatchObject({
			superAdmin: credentials.superAdmin,
			admin: credentials.admin,
			employee: credentials.employee
		});
		await notices.show();

		expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
		expect(dialogOptions().detail).toContain(credentials.superAdmin);
	});

	it('leaves out an account whose password the operator set in the environment', async () => {
		startAndSeed({ DEMO_ADMIN_PASSWORD: 'operator-chosen-password' });
		mockShowMessageBox.mockResolvedValueOnce({ response: 1 });

		await notices.show();

		expect(dialogOptions().detail).toContain('admin@ever.co');
		expect(dialogOptions().detail).not.toContain('local.admin@ever.co');
		expect(dialogOptions().detail).not.toContain('operator-chosen-password');
	});

	it('shows a seed recorded after the app asked to show (Gauzy Server: dashboard first, then Start)', async () => {
		await notices.show();
		expect(mockShowMessageBox).not.toHaveBeenCalled();

		mockShowMessageBox.mockResolvedValueOnce({ response: 1 });
		startAndSeed();
		await notices.show();

		expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
	});

	it('does not show a seed recorded before anything asked to (Gauzy Desktop relaunches after setup)', () => {
		startAndSeed();

		expect(mockShowMessageBox).not.toHaveBeenCalled();
		expect((mockStore.get(DESKTOP_SEED_CREDENTIALS_STORE_KEY) as { pending: unknown[] }).pending).toHaveLength(3);
	});

	describe('an existing database still on the published passwords', () => {
		it('warns once per run and changes nothing', async () => {
			notices.recordPublishedPasswords(['admin@ever.co', 'employee@ever.co']);
			mockShowMessageBox.mockResolvedValue({ response: 0 });

			await notices.show();
			await notices.show();

			expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
			expect(dialogOptions().detail).toContain(
				'admin@ever.co, employee@ever.co still sign in with the default password'
			);
			expect(mockStore.size).toBe(0);
		});

		it('warns when the report arrives after the app asked to show (stderr after "Listening at")', async () => {
			mockShowMessageBox.mockResolvedValue({ response: 0 });
			await notices.show();

			notices.recordPublishedPasswords(['admin@ever.co']);
			await notices.show();

			expect(mockShowMessageBox).toHaveBeenCalledTimes(1);
		});

		it('shows the generated passwords first when both are pending', async () => {
			startAndSeed();
			notices.recordPublishedPasswords(['old@ever.co']);
			mockShowMessageBox.mockResolvedValueOnce({ response: 1 }).mockResolvedValueOnce({ response: 0 });

			await notices.show();

			expect(mockShowMessageBox).toHaveBeenCalledTimes(2);
			expect(dialogOptions(0).buttons).toEqual(['Copy', 'I have saved them']);
			expect(dialogOptions(1).detail).toContain('old@ever.co');
		});
	});

	it('attaches the dialog to the window while it is open, and shows it on its own once it is closed', async () => {
		const open = { isDestroyed: () => false };
		const closed = { isDestroyed: () => true };
		notices.recordPublishedPasswords(['admin@ever.co']);
		mockShowMessageBox.mockResolvedValue({ response: 0 });

		await notices.show(open as any);
		expect(mockShowMessageBox.mock.calls[0][0]).toBe(open);

		restartApp();
		startAndSeed();
		mockShowMessageBox.mockResolvedValueOnce({ response: 1 });
		await notices.show(closed as any);
		expect(mockShowMessageBox).toHaveBeenCalledTimes(2);
		expect(mockShowMessageBox.mock.calls[1]).toHaveLength(1);
	});

	it('uses the translations when they are loaded', async () => {
		const { TranslateService } = require('./translation');
		TranslateService.instant.mockImplementation((key: string, params?: Record<string, string>) =>
			key === 'TIMER_TRACKER.DIALOG.SEED_CREDENTIALS_DETAIL' ? `Vos comptes :\n${params.accounts}` : key
		);
		const credentials = startAndSeed();
		mockShowMessageBox.mockResolvedValueOnce({ response: 1 });

		await notices.show();

		expect(dialogOptions().detail).toMatch(/^Vos comptes :\n/);
		expect(dialogOptions().detail).toContain(credentials.employee);
	});

	it('never throws, even when the store cannot be read', async () => {
		const failing = () => {
			throw new Error('store is locked');
		};
		const get = jest.spyOn(mockStore, 'get').mockImplementation(failing);
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		expect(() => notices.recordSeed({})).not.toThrow();
		await expect(notices.show()).resolves.toBeUndefined();

		get.mockRestore();
		error.mockRestore();
	});
});
