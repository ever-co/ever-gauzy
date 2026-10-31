import { Inject, Injectable, Optional } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GAUZY_ENV } from '../../constants';
import { ElectronService } from '../../electron/services';
import { buildTimeActivitiesUrl, isHttpUrl, resolveWebAppBaseUrl } from './web-portal-url';

/** The main-process channel answering the address of the web UI the app serves on this computer (`null` when none runs). */
export const LOCAL_WEB_APP_URL_CHANNEL = 'GET_LOCAL_WEB_APP_URL';

/** The main-process channel answering the address of Gauzy Cloud's API, which the main process keeps. */
export const CLOUD_API_URL_CHANNEL = 'GET_GAUZY_CLOUD_API_URL';

/**
 * The time tracker's link to the web app (#9517): opens the employee's time and activity of today in the browser.
 * The link is offered only where the web app's address is known (Gauzy Cloud, or a web UI served on this computer).
 */
@Injectable({
	providedIn: 'root'
})
export class WebPortalService {
	private readonly _baseUrl$ = new BehaviorSubject<string | null>(null);

	constructor(
		private readonly _electronService: ElectronService,
		@Optional()
		@Inject(GAUZY_ENV)
		private readonly _environment: { GAUZY_CLOUD_APP?: string } | null
	) {}

	/** The web app's base address, `null` while unknown (the link is hidden then). */
	public get baseUrl$(): Observable<string | null> {
		return this._baseUrl$.asObservable();
	}

	/** Works out where the web app is for the API the time tracker uses (`apiHost`). */
	public async refresh(apiHost: string | null | undefined): Promise<void> {
		const [localWebAppUrl, cloudApiUrl] = await Promise.all([
			this._askMainProcess(LOCAL_WEB_APP_URL_CHANNEL, 'local web app address'),
			this._askMainProcess(CLOUD_API_URL_CHANNEL, 'Gauzy Cloud API address')
		]);

		this._baseUrl$.next(
			resolveWebAppBaseUrl({
				apiHost,
				cloudAppUrl: this._environment?.GAUZY_CLOUD_APP,
				localWebAppUrl,
				cloudApiUrl
			})
		);
	}

	/**
	 * Opens the employee's time and activity of today in the browser.
	 * @returns whether a page was opened (not when the web app, the organization or the employee is unknown).
	 */
	public async openTimeActivities(organizationId: string, employeeId: string): Promise<boolean> {
		const url = buildTimeActivitiesUrl(this._baseUrl$.getValue(), { organizationId, employeeId, date: new Date() });
		if (!isHttpUrl(url)) {
			return false;
		}
		await this._electronService.shell.openExternal(url);
		return true;
	}

	/**
	 * Asks the main process for an address on `channel`.
	 * @returns the address, or `null` when there is none or the main process has no such channel (no link from it then).
	 */
	private async _askMainProcess(channel: string, what: string): Promise<string | null> {
		try {
			return (await this._electronService.ipcRenderer?.invoke(channel)) ?? null;
		} catch (error) {
			console.warn(`[WebPortal] Could not read the ${what}`, error);
			return null;
		}
	}
}
