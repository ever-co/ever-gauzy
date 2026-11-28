import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
	APP_LAUNCHER_PLACEMENT_STORAGE_KEY,
	APP_LAUNCHER_WIDE_MIN_WIDTH,
	AppLauncherPlacement,
	EVER_APPS,
	everAppAddUrl,
	hasOtherEverApp,
	IEverApp,
	parseAppLauncherPlacement,
	resolveEverApps,
	serializeAppLauncherPlacement
} from '@gauzy/ui-core/common';
import { GAUZY_ENV } from '@gauzy/ui-config';
import { ElectronService } from '../auth/electron.service';

/**
 * The App Launcher: the list of Ever apps this deployment links, and where the person keeps the shortcut to it
 * (`sidebar`, `header` or `rail`, see {@link AppLauncherPlacement}), stored in this browser under Ever Teams' key.
 *
 * Every piece of the launcher reads this one service: the Ever mark in the sidebar, the grid button in the top bar,
 * the rail, and the three tiles on the profile page. Nothing shows when the deployment links no other app.
 */
@Injectable({ providedIn: 'root' })
export class AppLauncherService {
	private readonly _document = inject(DOCUMENT);
	private readonly _environment = inject(GAUZY_ENV, { optional: true });
	private readonly _electronService = inject(ElectronService, { optional: true });

	/** The Ever apps, in the catalog's order, as this deployment serves them. */
	readonly apps: ReadonlyArray<IEverApp> = resolveEverApps(
		inject(EVER_APPS),
		this._environment?.EVER_APP_LINKS,
		this._environment?.CLIENT_BASE_URL
	);

	/** Whether the launcher shows at all: the deployment links at least one other Ever app. */
	readonly isAvailable = hasOtherEverApp(this.apps);

	/**
	 * Where the "+ Add" row goes: Ever Platform's page for adding one's own apps, in this deployment's Ever Platform.
	 * `null` (no row) when the list has no Ever Platform.
	 */
	readonly addUrl: string | null = everAppAddUrl(this.apps);

	private readonly _storedPlacement = signal<AppLauncherPlacement>(this._readStoredPlacement());
	/** Wide enough for the rail and the top bar's button; narrower (a phone), the mark opens the list. */
	private readonly _isWideViewport = signal<boolean>(this._watchWideViewport());

	/** The person's position, `null` when the launcher does not show. */
	readonly placement = computed<AppLauncherPlacement | null>(() =>
		this.isAvailable ? this._storedPlacement() : null
	);

	/** The rail is drawn: picked, on a viewport wide enough for it. */
	readonly showsRail = computed(() => this.placement() === 'rail' && this._isWideViewport());

	/**
	 * The grid button sits at the right end of the top bar: picked, on a viewport wide enough for it. A phone's top
	 * bar is already full (the date range and the selectors' toggle), so there the mark opens the list instead.
	 */
	readonly showsHeaderButton = computed(() => this.placement() === 'header' && this._isWideViewport());

	/**
	 * The Ever mark in the sidebar opens the list: picked, or on a phone whatever the position, since the phone shows
	 * neither the rail nor the top bar's button. The person then finds the list where it always was.
	 */
	readonly showsSidebarButton = computed(() => {
		const placement = this.placement();
		if (placement === null) {
			return false;
		}
		return placement === 'sidebar' || !this._isWideViewport();
	});

	constructor() {
		// Another tab of this browser changed the position, or cleared the storage (`key` is null then): follow it,
		// as the choice is per browser. Read what is stored now, as at start, rather than the event's own value.
		this._document.defaultView?.addEventListener('storage', (event: StorageEvent) => {
			const isOurs = event.key === null || event.key === APP_LAUNCHER_PLACEMENT_STORAGE_KEY;
			if (isOurs) {
				this._storedPlacement.set(this._readStoredPlacement());
			}
		});
	}

	/**
	 * Keeps the person's position in this browser. The screen follows at once, even when the browser refuses to
	 * store it (private mode, storage full): the choice then lasts until the page reloads.
	 *
	 * @returns Whether the browser stored it.
	 */
	setPlacement(placement: AppLauncherPlacement): boolean {
		this._storedPlacement.set(placement);
		try {
			this._document.defaultView?.localStorage.setItem(
				APP_LAUNCHER_PLACEMENT_STORAGE_KEY,
				serializeAppLauncherPlacement(placement)
			);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Opens another Ever app. In the browser the link does it, in the same tab (a modifier-click still opens a new
	 * one, as for any link); inside the desktop apps a plain link would load the other app into the Gauzy window
	 * itself, so the system browser opens it instead.
	 *
	 * @param event - The click on the app's link.
	 * @param app - The app to open.
	 */
	openApp(event: MouseEvent, app: IEverApp): void {
		this.openLink(event, app.url);
	}

	/**
	 * Follows one of the launcher's links ({@link openApp}, the "+ Add" row): the link itself in the browser, the
	 * system browser inside the desktop apps.
	 *
	 * @param event - The click on the link.
	 * @param url - The link's address.
	 */
	openLink(event: MouseEvent, url: string): void {
		const shell = this._electronService?.shell;
		if (typeof shell?.openExternal !== 'function') {
			return;
		}
		event.preventDefault();
		shell.openExternal(url);
	}

	private _readStoredPlacement(): AppLauncherPlacement {
		try {
			const stored = this._document.defaultView?.localStorage.getItem(APP_LAUNCHER_PLACEMENT_STORAGE_KEY);
			return parseAppLauncherPlacement(stored);
		} catch {
			return parseAppLauncherPlacement(null);
		}
	}

	/** Whether the viewport is wide enough for the rail now; keeps `_isWideViewport` current as it resizes. */
	private _watchWideViewport(): boolean {
		const matchMedia = this._document.defaultView?.matchMedia;
		if (typeof matchMedia !== 'function') {
			return true;
		}
		const query = matchMedia.call(this._document.defaultView, `(min-width: ${APP_LAUNCHER_WIDE_MIN_WIDTH}px)`);
		query.addEventListener?.('change', (event: MediaQueryListEvent) => this._isWideViewport.set(event.matches));
		return query.matches;
	}
}
