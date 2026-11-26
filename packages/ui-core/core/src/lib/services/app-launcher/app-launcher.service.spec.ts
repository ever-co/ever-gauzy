import { DOCUMENT } from '@angular/common';
import { Injector, runInInjectionContext } from '@angular/core';
import { APP_LAUNCHER_PLACEMENT_STORAGE_KEY, EVER_APPS, IEverApp } from '@gauzy/ui-core/common';
import { GAUZY_ENV } from '@gauzy/ui-config';
import { ElectronService } from '../auth/electron.service';
import { AppLauncherService } from './app-launcher.service';

const GAUZY: IEverApp = {
	id: 'gauzy',
	shortName: 'Gauzy',
	logo: 'g.svg',
	url: 'https://gauzy.catalog.test',
	domain: 'gauzy.catalog.test'
};
const TEAMS: IEverApp = {
	id: 'teams',
	shortName: 'Teams',
	logo: 't.svg',
	url: 'https://teams.catalog.test',
	domain: 'teams.catalog.test'
};

interface SetupOptions {
	apps?: ReadonlyArray<IEverApp>;
	stored?: string | null;
	wide?: boolean;
	storageRefuses?: boolean;
	shell?: { openExternal: jest.Mock } | null;
	environment?: Record<string, string>;
}

/** A fresh service over a fake window: its storage, its `matchMedia`, and its `storage` events. */
function setup(options: SetupOptions = {}) {
	const store = new Map<string, string>();
	if (options.stored !== undefined && options.stored !== null) {
		store.set(APP_LAUNCHER_PLACEMENT_STORAGE_KEY, options.stored);
	}
	const localStorage = {
		getItem: jest.fn((key: string) => store.get(key) ?? null),
		setItem: jest.fn((key: string, value: string) => {
			if (options.storageRefuses) {
				throw new Error('QuotaExceededError');
			}
			store.set(key, value);
		})
	};
	const windowListeners = new Map<string, (event: unknown) => void>();
	let mediaListener: ((event: { matches: boolean }) => void) | undefined;
	const defaultView = {
		localStorage,
		addEventListener: (type: string, listener: (event: unknown) => void) => windowListeners.set(type, listener),
		matchMedia: jest.fn((_query: string) => ({
			matches: options.wide ?? true,
			addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
				mediaListener = listener;
			}
		}))
	};
	const injector = Injector.create({
		providers: [
			{ provide: DOCUMENT, useValue: { defaultView } },
			{ provide: EVER_APPS, useValue: options.apps ?? [TEAMS, GAUZY] },
			{ provide: GAUZY_ENV, useValue: options.environment ?? {} },
			{ provide: ElectronService, useValue: { shell: options.shell ?? undefined } }
		]
	});
	const service = runInInjectionContext(injector, () => new AppLauncherService());
	return {
		service,
		store,
		matchMedia: defaultView.matchMedia,
		resize: (wide: boolean) => mediaListener?.({ matches: wide }),
		storageEvent: (key: string, newValue: string | null) => windowListeners.get('storage')?.({ key, newValue })
	};
}

describe('AppLauncherService', () => {
	it('keeps the launcher in the sidebar for a person who never chose a position', () => {
		const { service } = setup();
		expect(service.isAvailable).toBe(true);
		expect(service.placement()).toBe('sidebar');
		expect(service.showsSidebarButton()).toBe(true);
		expect(service.showsHeaderButton()).toBe(false);
		expect(service.showsRail()).toBe(false);
	});

	it('reads the position Ever Teams stores (a JSON string)', () => {
		const { service } = setup({ stored: '"header"' });
		expect(service.placement()).toBe('header');
		expect(service.showsHeaderButton()).toBe(true);
		expect(service.showsSidebarButton()).toBe(false);
	});

	it('shows the top bar button on a wide screen, and falls back to the sidebar mark on a phone', () => {
		const { service, resize } = setup({ stored: '"header"', wide: true });
		expect(service.showsHeaderButton()).toBe(true);
		expect(service.showsSidebarButton()).toBe(false);

		resize(false);
		expect(service.showsHeaderButton()).toBe(false);
		expect(service.showsSidebarButton()).toBe(true);
	});

	it('draws the rail on a wide screen, and falls back to the sidebar mark on a phone', () => {
		const { service, resize, matchMedia } = setup({ stored: '"rail"', wide: true });
		expect(matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
		expect(service.showsRail()).toBe(true);
		expect(service.showsSidebarButton()).toBe(false);

		resize(false);
		expect(service.showsRail()).toBe(false);
		expect(service.showsSidebarButton()).toBe(true);
	});

	it('stores a new position under Ever Teams key and shows it at once', () => {
		const { service, store } = setup();
		expect(service.setPlacement('rail')).toBe(true);
		expect(store.get(APP_LAUNCHER_PLACEMENT_STORAGE_KEY)).toBe('"rail"');
		expect(service.placement()).toBe('rail');
	});

	it('still follows a new position when the browser refuses to store it', () => {
		const { service } = setup({ storageRefuses: true });
		expect(service.setPlacement('header')).toBe(false);
		expect(service.placement()).toBe('header');
	});

	it('follows a position changed in another tab of this browser', () => {
		const { service, storageEvent } = setup();
		storageEvent(APP_LAUNCHER_PLACEMENT_STORAGE_KEY, '"header"');
		expect(service.placement()).toBe('header');
		storageEvent('some-other-key', '"rail"');
		expect(service.placement()).toBe('header');
		storageEvent(APP_LAUNCHER_PLACEMENT_STORAGE_KEY, null);
		expect(service.placement()).toBe('sidebar');
	});

	it('shows nothing when the deployment links no other app', () => {
		const { service } = setup({ apps: [GAUZY], stored: '"rail"' });
		expect(service.isAvailable).toBe(false);
		expect(service.placement()).toBeNull();
		expect(service.showsRail()).toBe(false);
		expect(service.showsHeaderButton()).toBe(false);
		expect(service.showsSidebarButton()).toBe(false);
	});

	it('lists each app at the address this deployment gives it', () => {
		const { service } = setup({
			environment: {
				EVER_APP_LINKS: 'teams=https://teams.stage.test',
				CLIENT_BASE_URL: 'https://gauzy.self-hosted.test'
			}
		});
		expect(service.apps.map((app) => app.url)).toEqual([
			'https://teams.stage.test/',
			'https://gauzy.self-hosted.test'
		]);
	});

	it('opens another app in the system browser inside the desktop apps', () => {
		const openExternal = jest.fn();
		const { service } = setup({ shell: { openExternal } });
		const event = { preventDefault: jest.fn() } as unknown as MouseEvent;
		service.openApp(event, TEAMS);
		expect(event.preventDefault).toHaveBeenCalled();
		expect(openExternal).toHaveBeenCalledWith(TEAMS.url);
	});

	it('lets the link open a new tab in the browser', () => {
		const { service } = setup();
		const event = { preventDefault: jest.fn() } as unknown as MouseEvent;
		service.openApp(event, TEAMS);
		expect(event.preventDefault).not.toHaveBeenCalled();
	});
});
