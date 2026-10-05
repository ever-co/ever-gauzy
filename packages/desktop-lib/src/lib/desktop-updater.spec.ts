import { GithubCdn } from './decorators/concretes/github-cdn';
import { DesktopUpdater } from './desktop-updater';
import { CdnUpdate } from './strategies/concretes/cdn-update';

/**
 * The GitHub update feed is https://github.com/<owner>/<repo>/releases/download/<tag>, with the tag
 * looked up through the unauthenticated GitHub API. A failed lookup (e.g. the 60 requests/hour rate
 * limit) used to produce the tag `111.44.45` instead of `v111.44.45`, a 404 feed, and the tag was only
 * looked up at startup, so a long-running app never saw a newer release.
 *
 * Since each check can now find a newer release, the "new version available" dialog and the automatic
 * update setting from the settings page are covered here too.
 *
 * Electron cannot run here, so electron, electron-updater and node-fetch are mocked.
 */
jest.mock(
	'electron',
	() => ({
		app: { getVersion: () => '111.44.45', getName: () => 'gauzy-server' },
		ipcMain: { on: jest.fn(), once: jest.fn() },
		BrowserWindow: class {}
	}),
	{ virtual: true }
);
jest.mock(
	'electron-updater',
	() => {
		const { EventEmitter } = jest.requireActual('events');
		const autoUpdater: any = Object.assign(new EventEmitter(), {
			checked: [],
			downloaded: [],
			setFeedURL: jest.fn()
		});
		const feedUrl = () => autoUpdater.setFeedURL.mock.calls.at(-1)[0].url;
		// Like electron-updater, a check whose feed holds a version other than the running one announces it.
		const announce = () => {
			const version = /\/download\/v(.+)$/.exec(feedUrl())?.[1];
			if (version && version !== '111.44.45') autoUpdater.emit('update-available', { version });
		};
		autoUpdater.checkForUpdates = jest.fn(async () => {
			autoUpdater.checked.push(feedUrl());
			announce();
		});
		autoUpdater.checkForUpdatesAndNotify = jest.fn(async () => {
			autoUpdater.downloaded.push(feedUrl());
			announce();
		});
		return { autoUpdater, CancellationToken: class {} };
	},
	{ virtual: true }
);
jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('./desktop-store', () => ({ LocalStore: { getStore: jest.fn() } }));
jest.mock('./desktop-notifier', () => {
	const customNotification = jest.fn();
	return {
		__esModule: true,
		default: class {
			customNotification = customNotification;
		},
		customNotification
	};
});
jest.mock('./translation', () => ({
	TranslateService: { instant: (key: string, params?: object) => (params ? `${key} ${JSON.stringify(params)}` : key) }
}));
jest.mock('./config', () => ({ LOCAL_SERVER_UPDATE_CONFIG: { PORT: 11999 } }));
jest.mock('./desktop-dialog', () => ({ DesktopDialog: class {} }));
jest.mock('./update-server/desktop-local-update-server', () => ({
	DesktopLocalUpdateServer: class {
		fileUri() {}
		restart() {}
		stop() {}
	}
}));
jest.mock('./contexts', () => ({
	...jest.requireActual('./contexts/automatic-update'),
	...jest.requireActual('./contexts/update-context')
}));
jest.mock('./strategies', () => ({
	...jest.requireActual('./strategies/concretes/cdn-update'),
	...jest.requireActual('./strategies/concretes/local-update')
}));
jest.mock('./decorators', () => {
	class Dialog {
		options: any = {};
		async show() {
			return { response: 1 };
		}
		open() {
			return ['C:/updates'];
		}
	}
	// The "new version available, download it?" dialog; each test decides how the user answers it.
	const showUpgradeDialog = jest.fn();
	class UpgradeDialog extends Dialog {
		show() {
			return showUpgradeDialog(this.options);
		}
	}
	// The "ready to install, restart now?" dialog shown when a download has finished.
	const showInstallDialog = jest.fn();
	class InstallDialog extends Dialog {
		show() {
			return showInstallDialog(this.options);
		}
	}
	return {
		...jest.requireActual('./decorators/concretes/github-cdn'),
		DialogConfirmInstallDownload: InstallDialog,
		DialogConfirmUpgradeDownload: UpgradeDialog,
		DialogLocalUpdate: Dialog,
		showUpgradeDialog,
		showInstallDialog
	};
});

const HOUR = 60 * 60 * 1000;
const CONFIG = { owner: 'ever-co', repository: 'ever-gauzy-server', typeRelease: 'releases' };
const FEED = 'https://github.com/ever-co/ever-gauzy-server/releases/download/';
const ALL_FILES = [
	'latest-x64.yml',
	'latest-arm64.yml',
	'latest-x64-linux.yml',
	'latest-arm64-linux-arm64.yml',
	'latest-mac.yml'
];

const fetchMock: jest.Mock = jest.requireMock('node-fetch').default;
const getStore: jest.Mock = jest.requireMock('./desktop-store').LocalStore.getStore;
const autoUpdater = jest.requireMock('electron-updater').autoUpdater;
const ipcOn: jest.Mock = jest.requireMock('electron').ipcMain.on;
const showUpgradeDialog: jest.Mock = jest.requireMock('./decorators').showUpgradeDialog;
const showInstallDialog: jest.Mock = jest.requireMock('./decorators').showInstallDialog;
const customNotification: jest.Mock = jest.requireMock('./desktop-notifier').customNotification;

const release = (tag: string, prerelease = false, files = ALL_FILES) => ({
	tag_name: tag,
	prerelease,
	assets: files.map((name) => ({ name }))
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
/** The handler the most recently constructed DesktopUpdater registered for an ipc channel. */
const ipc = (channel: string) => ipcOn.mock.calls.filter(([name]) => name === channel).at(-1)[1];
const lastChecked = () => autoUpdater.checked.at(-1);
/** The versions the "new version available" dialog was shown for, in order. */
const offered = () => showUpgradeDialog.mock.calls.map(([options]) => /"next":"([^"]+)"/.exec(options.detail)[1]);

describe('GitHub update feed', () => {
	let releases: any[];
	let appSetting: any;
	const platform = process.platform;
	const arch = process.arch;
	const setPlatform = (value: string, cpu: string) => {
		Object.defineProperty(process, 'platform', { value, configurable: true });
		Object.defineProperty(process, 'arch', { value: cpu, configurable: true });
	};
	const api = {
		ok: () => fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => releases })),
		down: () =>
			fetchMock.mockImplementation(async () => {
				throw new Error('getaddrinfo ENOTFOUND api.github.com');
			}),
		rateLimited: () =>
			fetchMock.mockImplementation(async () => ({
				ok: false,
				status: 403,
				json: async () => ({ message: 'API rate limit exceeded for 203.0.113.7.' })
			}))
	};

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'], now: new Date('2026-09-24T12:00:00Z') });
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		setPlatform('win32', 'x64');
		autoUpdater.removeAllListeners();
		autoUpdater.checked = [];
		autoUpdater.downloaded = [];
		showUpgradeDialog.mockResolvedValue({ response: 1 });
		showInstallDialog.mockResolvedValue({ response: 1 });
		releases = [release('v111.44.45')];
		appSetting = {
			automaticUpdate: true,
			automaticUpdateDelay: 1,
			prerelease: false,
			cdnUpdater: { github: true }
		};
		getStore.mockImplementation((key: string) => (key === 'appSetting' ? appSetting : undefined));
		api.ok();
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
		setPlatform(platform, arch);
	});

	describe('tag lookup', () => {
		it('uses the v-prefixed tag of the newest release', async () => {
			releases = [release('v111.44.48'), release('v111.44.45')];
			const cdn = new GithubCdn(new CdnUpdate(CONFIG));

			await cdn.initialize();

			expect(cdn.url).toBe(FEED + 'v111.44.48');
		});

		it('falls back to v<running version> when the API is unreachable and nothing was resolved yet', async () => {
			api.down();

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.45');
		});

		it('treats a rate-limit answer (an object, not a list) as a failed lookup', async () => {
			api.rateLimited();

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.45');
		});

		it('falls back to v<running version> when the prerelease setting cannot be read and nothing was resolved yet', async () => {
			getStore.mockImplementation(() => {
				throw new Error('Unexpected token in JSON at position 0');
			});

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.45');
		});

		it('bounds the GitHub lookup with a timeout, since it now runs before every check', async () => {
			await new CdnUpdate(CONFIG).tagName();

			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining('https://api.github.com/repos/'),
				expect.objectContaining({ timeout: 10 * 1000 })
			);
		});

		it('keeps the last resolved tag when a later lookup fails', async () => {
			releases = [release('v111.44.48')];
			const cdn = new CdnUpdate(CONFIG);
			await cdn.tagName();
			jest.advanceTimersByTime(HOUR);
			api.rateLimited();

			expect(await cdn.tagName()).toBe('v111.44.48');
		});

		it('picks the newest prerelease when the prerelease channel is enabled', async () => {
			appSetting.prerelease = true;
			releases = [release('v111.44.49', true), release('v111.44.48'), release('v111.44.15', true)];

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.49');
		});

		it('still offers a newer stable release when the prerelease channel is enabled', async () => {
			appSetting.prerelease = true;
			releases = [release('v111.44.48'), release('v111.44.47', true), release('v111.44.15', true)];

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.48');
		});

		it('never offers a prerelease when the prerelease channel is disabled', async () => {
			releases = [release('v111.44.49', true), release('v111.44.48'), release('v111.44.47', true)];

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.48');
		});

		it('on the prerelease channel, prefers the newest release of either kind that has the update file', async () => {
			appSetting.prerelease = true;
			const withoutWindowsFile = ALL_FILES.filter((name) => name !== 'latest-x64.yml');
			releases = [
				release('v111.44.49', true, withoutWindowsFile),
				release('v111.44.48'),
				release('v111.44.47', true)
			];

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.48');
		});

		it.each([
			['win32', 'x64', 'latest-x64.yml'],
			['win32', 'arm64', 'latest-arm64.yml'],
			['linux', 'x64', 'latest-x64-linux.yml'],
			['linux', 'arm64', 'latest-arm64-linux-arm64.yml'],
			['darwin', 'arm64', 'latest-mac.yml']
		])('%s/%s: skips a release whose %s is not uploaded yet', async (os, cpu, file) => {
			setPlatform(os, cpu);
			const uploadedSoFar = ALL_FILES.filter((name) => name !== file);
			releases = [release('v111.44.48', false, uploadedSoFar), release('v111.44.45')];
			const cdn = new CdnUpdate(CONFIG);

			expect(await cdn.tagName()).toBe('v111.44.45');
			releases[0].assets.push({ name: file });
			jest.advanceTimersByTime(HOUR);
			expect(await cdn.tagName()).toBe('v111.44.48');
		});
	});

	describe('DesktopUpdater', () => {
		it('re-resolves the tag on every hourly check, with one API call per check', async () => {
			new DesktopUpdater(CONFIG);
			await flush();
			expect(fetchMock).toHaveBeenCalledTimes(1);

			releases.unshift(release('v111.44.48'));
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(lastChecked()).toBe(FEED + 'v111.44.48');
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it('re-resolves the tag on a manual check_for_update', async () => {
			new DesktopUpdater(CONFIG);
			await flush();
			releases.unshift(release('v111.44.48'));
			jest.advanceTimersByTime(10 * 60 * 1000);

			await ipc('check_for_update')();

			expect(lastChecked()).toBe(FEED + 'v111.44.48');
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		it('resolves once for the startup check (constructor, checkUpdate() and its 5 s timer)', async () => {
			releases = [release('v111.44.48')];
			const updater = new DesktopUpdater(CONFIG);
			await flush();

			await updater.checkUpdate();
			await jest.advanceTimersByTimeAsync(5000);
			await flush();

			expect(lastChecked()).toBe(FEED + 'v111.44.48');
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('leaves the local update strategy alone', async () => {
			new DesktopUpdater(CONFIG);
			await flush();
			fetchMock.mockClear();

			await ipc('update_locally')();
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(autoUpdater.checked).toEqual(['http://localhost:11999/download', 'http://localhost:11999/download']);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	});

	describe('new version dialog', () => {
		it('offers each newer release the hourly check finds, once per version', async () => {
			new DesktopUpdater(CONFIG);
			await flush();

			releases.unshift(release('v111.44.46'));
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();
			// The same version again, already turned down with "skip now".
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();
			releases.unshift(release('v111.44.47'));
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(offered()).toEqual(['111.44.46', '111.44.47']);
			// The system notification still comes with every check that finds a version.
			expect(customNotification).toHaveBeenCalledTimes(3);
		});

		it('does not open a second dialog while one is still open', async () => {
			let answer: (button: { response: number }) => void;
			showUpgradeDialog.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
			new DesktopUpdater(CONFIG);
			await flush();

			autoUpdater.emit('update-available', { version: '111.44.46' });
			autoUpdater.emit('update-available', { version: '111.44.47' });
			expect(offered()).toEqual(['111.44.46']);

			answer({ response: 1 });
			await flush();
			autoUpdater.emit('update-available', { version: '111.44.47' });

			expect(offered()).toEqual(['111.44.46', '111.44.47']);
		});

		it('does not open on top of the install prompt, and asks once it is closed', async () => {
			let close: (button: { response: number }) => void;
			showUpgradeDialog.mockResolvedValue({ response: 0 });
			showInstallDialog.mockImplementationOnce(() => new Promise((resolve) => (close = resolve)));
			new DesktopUpdater(CONFIG);
			await flush();

			releases.unshift(release('v111.44.46'));
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();
			// The download chosen with Upgrade finishes, and its install prompt is left open.
			autoUpdater.emit('update-downloaded', { version: '111.44.46' });
			expect(showInstallDialog).toHaveBeenCalledTimes(1);
			releases.unshift(release('v111.44.47'));
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();
			expect(offered()).toEqual(['111.44.46']);

			close({ response: 1 });
			await flush();
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(offered()).toEqual(['111.44.46', '111.44.47']);
		});

		it('shows the install prompt only after the new version dialog is answered', async () => {
			let answer: (button: { response: number }) => void;
			showUpgradeDialog.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
			new DesktopUpdater(CONFIG);
			await flush();

			autoUpdater.emit('update-available', { version: '111.44.47' });
			// A download started earlier, e.g. from the settings page, finishes meanwhile.
			autoUpdater.emit('update-downloaded', { version: '111.44.46' });
			await flush();
			expect(showInstallDialog).not.toHaveBeenCalled();

			answer({ response: 1 });
			await flush();

			expect(showInstallDialog).toHaveBeenCalledTimes(1);
			expect(showInstallDialog.mock.calls[0][0].detail).toContain('"version":"111.44.46"');
		});

		it('does not ask again about a version the user chose to download', async () => {
			showUpgradeDialog.mockResolvedValue({ response: 0 });
			new DesktopUpdater(CONFIG);
			await flush();

			releases.unshift(release('v111.44.46'));
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(autoUpdater.downloaded).toEqual([FEED + 'v111.44.46']);
			expect(offered()).toEqual(['111.44.46']);
		});

		it('asks once automatic updates are turned on, not only for the first version found', async () => {
			appSetting.automaticUpdate = false;
			new DesktopUpdater(CONFIG);
			await flush();

			autoUpdater.emit('update-available', { version: '111.44.46' });
			expect(offered()).toEqual([]);

			appSetting.automaticUpdate = true;
			autoUpdater.emit('update-available', { version: '111.44.46' });

			expect(offered()).toEqual(['111.44.46']);
		});
	});

	describe('automatic update setting', () => {
		const changeSetting = (args: object) => ipc('automatic_update_setting')({}, args);
		const checks = () => autoUpdater.checked.length;

		it('applies a new delay chosen in the settings page to the automatic check', async () => {
			new DesktopUpdater(CONFIG);
			await flush();

			appSetting.automaticUpdateDelay = 24;
			changeSetting({ isEnabled: true, delay: 24 });
			await jest.advanceTimersByTimeAsync(23 * HOUR);
			expect(checks()).toBe(0);
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(checks()).toBe(1);
		});

		it.each([
			['delay', { isEnabled: true, delay: 3 }],
			['automaticUpdateDelay', { isEnabled: true, automaticUpdateDelay: 3 }]
		])('uses the delay sent as %s, not only the stored one', async (_, args) => {
			new DesktopUpdater(CONFIG);
			await flush();

			changeSetting(args);
			await jest.advanceTimersByTimeAsync(2 * HOUR);
			expect(checks()).toBe(0);
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(checks()).toBe(1);
		});

		it.each([undefined, 0, 1000])('falls back to the stored delay when the delay sent is %p', async (delay) => {
			appSetting.automaticUpdateDelay = 3;
			new DesktopUpdater(CONFIG);
			await flush();

			changeSetting({ isEnabled: true, delay });
			// 1000 hours does not fit in setInterval, which would then fire every millisecond.
			await jest.advanceTimersByTimeAsync(1000);
			expect(checks()).toBe(0);
			await jest.advanceTimersByTimeAsync(3 * HOUR - 1000);
			await flush();

			expect(checks()).toBe(1);
		});

		it('stops the automatic check when turned off and starts it again when turned on', async () => {
			new DesktopUpdater(CONFIG);
			await flush();

			appSetting.automaticUpdate = false;
			changeSetting({ isEnabled: false, delay: 1 });
			await jest.advanceTimersByTimeAsync(2 * HOUR);
			expect(checks()).toBe(0);

			appSetting.automaticUpdate = true;
			changeSetting({ isEnabled: true, delay: 1 });
			await jest.advanceTimersByTimeAsync(HOUR);
			await flush();

			expect(checks()).toBe(1);
		});
	});
});
