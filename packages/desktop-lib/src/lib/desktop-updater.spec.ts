import { GithubCdn } from './decorators/concretes/github-cdn';
import { DesktopUpdater } from './desktop-updater';
import { CdnUpdate } from './strategies/concretes/cdn-update';

/**
 * The GitHub update feed is https://github.com/<owner>/<repo>/releases/download/<tag>, with the tag
 * looked up through the unauthenticated GitHub API. A failed lookup (e.g. the 60 requests/hour rate
 * limit) used to produce the tag `111.44.45` instead of `v111.44.45`, a 404 feed, and the tag was only
 * looked up at startup, so a long-running app never saw a newer release.
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
		const autoUpdater: any = {
			checked: [],
			downloaded: [],
			setFeedURL: jest.fn(),
			on: jest.fn(),
			once: jest.fn()
		};
		const feedUrl = () => autoUpdater.setFeedURL.mock.calls.at(-1)[0].url;
		autoUpdater.checkForUpdates = jest.fn(async () => autoUpdater.checked.push(feedUrl()));
		autoUpdater.checkForUpdatesAndNotify = jest.fn(async () => autoUpdater.downloaded.push(feedUrl()));
		return { autoUpdater, CancellationToken: class {} };
	},
	{ virtual: true }
);
jest.mock('node-fetch', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('./desktop-store', () => ({ LocalStore: { getStore: jest.fn() } }));
jest.mock('./desktop-notifier', () => ({ __esModule: true, default: class {} }));
jest.mock('./translation', () => ({ TranslateService: { instant: (key: string) => key } }));
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
		options = {};
		async show() {
			return { response: 1 };
		}
		open() {
			return ['C:/updates'];
		}
	}
	return {
		...jest.requireActual('./decorators/concretes/github-cdn'),
		DialogConfirmInstallDownload: Dialog,
		DialogConfirmUpgradeDownload: Dialog,
		DialogLocalUpdate: Dialog
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

const release = (tag: string, prerelease = false, files = ALL_FILES) => ({
	tag_name: tag,
	prerelease,
	assets: files.map((name) => ({ name }))
});
const flush = () => new Promise((resolve) => setImmediate(resolve));
/** The handler the most recently constructed DesktopUpdater registered for an ipc channel. */
const ipc = (channel: string) => ipcOn.mock.calls.filter(([name]) => name === channel).at(-1)[1];
const lastChecked = () => autoUpdater.checked.at(-1);

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
		autoUpdater.checked = [];
		autoUpdater.downloaded = [];
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

		it('picks the newest prerelease when prereleases are enabled', async () => {
			appSetting.prerelease = true;
			releases = [release('v111.44.48'), release('v111.44.47', true), release('v111.44.15', true)];

			expect(await new CdnUpdate(CONFIG).tagName()).toBe('v111.44.47');
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
});
