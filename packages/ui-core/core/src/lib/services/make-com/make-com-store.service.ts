import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { IMakeComIntegrationSettings } from '@gauzy/contracts';
import { MakeComService } from './make-com.service';

@Injectable({
	providedIn: 'root'
})
export class MakeComStoreService {
	private _settings$: BehaviorSubject<IMakeComIntegrationSettings | null> =
		new BehaviorSubject<IMakeComIntegrationSettings | null>(null);
	public settings$: Observable<IMakeComIntegrationSettings | null> = this._settings$.asObservable();

	constructor(private readonly _makeComService: MakeComService) {}

	/**
	 * Loads the current Make.com integration settings
	 * @returns An observable of the settings
	 */
	loadIntegrationSettings(): Observable<IMakeComIntegrationSettings> {
		return this._makeComService.getIntegrationSettings().pipe(
			tap((settings) => this._settings$.next(settings)),
			catchError((error) => {
				console.error('Error loading Make.com integration settings:', error);
				return throwError(() => error);
			})
		);
	}

	/**
	 * Updates the Make.com integration settings
	 * @param settings The updated settings
	 * @returns An observable of the updated settings
	 */
	updateIntegrationSettings(settings: {
		isEnabled: boolean;
		webhookUrl: string;
	}): Observable<IMakeComIntegrationSettings> {
		return this._makeComService.updateIntegrationSettings(settings).pipe(
			tap((updatedSettings) => this._settings$.next(updatedSettings)),
			catchError((error) => {
				console.error('Error updating Make.com integration settings:', error);
				return throwError(() => error);
			})
		);
	}

	/**
	 * Initialize Make.com integration.
	 * No client credentials needed — server uses its own env-configured credentials.
	 */
	initializeIntegration(body: { organizationId: string }): Observable<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		return this._makeComService.initializeIntegration(body).pipe(
			catchError((error) => {
				console.error('Error initializing Make.com integration:', error);
				return throwError(() => error);
			})
		);
	}

	/**
	 * Gets the current integration settings without making an API call
	 * @returns The current settings or null if not loaded
	 */
	getCurrentSettings(): IMakeComIntegrationSettings | null {
		return this._settings$.getValue();
	}

	/**
	 * Clears all stored data
	 */
	clearStore(): void {
		this._settings$.next(null);
	}
}
