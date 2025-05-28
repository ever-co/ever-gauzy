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

	private _oauthConfig$: BehaviorSubject<{ clientId: string; redirectUri: string } | null> = new BehaviorSubject<{
		clientId: string;
		redirectUri: string;
	} | null>(null);
	public oauthConfig$: Observable<{ clientId: string; redirectUri: string } | null> =
		this._oauthConfig$.asObservable();

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
	 * Adds or updates Make.com OAuth settings
	 * @param credentials The OAuth credentials
	 * @returns An observable of the updated settings
	 */
	addOAuthSettings(credentials: { clientId: string; clientSecret: string }): Observable<{
		authorizationUrl: string;
		integrationId: string;
	}> {
		return this._makeComService.addOAuthSettings(credentials).pipe(
			catchError((error) => {
				console.error('Error adding Make.com OAuth settings:', error);
				return throwError(() => error);
			})
		);
	}

	/**
	 * Loads the OAuth configuration
	 * @returns An observable of the OAuth config
	 */
	loadOAuthConfig(): Observable<{ clientId: string; redirectUri: string }> {
		return this._makeComService.getOAuthConfig().pipe(
			tap((config) => this._oauthConfig$.next(config)),
			catchError((error) => {
				console.error('Error loading Make.com OAuth config:', error);
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
	 * Gets the current OAuth configuration without making an API call
	 * @returns The current OAuth config or null if not loaded
	 */
	getCurrentOAuthConfig(): { clientId: string; redirectUri: string } | null {
		return this._oauthConfig$.getValue();
	}

	/**
	 * Clears all stored data
	 */
	clearStore(): void {
		this._settings$.next(null);
		this._oauthConfig$.next(null);
	}
}
