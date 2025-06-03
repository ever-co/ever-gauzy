import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IZapierEndpoint, IZapierWebhook } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class ZapierStoreService {
	private _triggers$: BehaviorSubject<IZapierEndpoint[]> = new BehaviorSubject([]);
	private _actions$: BehaviorSubject<IZapierEndpoint[]> = new BehaviorSubject([]);
	private _isLoading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	private _error$: BehaviorSubject<string> = new BehaviorSubject(null);
	private _webhooks$: BehaviorSubject<IZapierWebhook[]> = new BehaviorSubject([]);
	private _isWebhookLoading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	private _webhookError$: BehaviorSubject<string> = new BehaviorSubject(null);

	/**
	 * Get available triggers
	 */
	get triggers$(): Observable<IZapierEndpoint[]> {
		return this._triggers$.asObservable();
	}

	/**
	 * Get available actions
	 */
	get actions$(): Observable<IZapierEndpoint[]> {
		return this._actions$.asObservable();
	}

	/**
	 * Get loading state
	 */
	get isLoading$(): Observable<boolean> {
		return this._isLoading$.asObservable();
	}

	/**
	 * Get error state
	 */
	get error$(): Observable<string> {
		return this._error$.asObservable();
	}

	/**
	 * Get webhooks state
	 */
	get webhooks$(): Observable<IZapierWebhook[]> {
		return this._webhooks$.asObservable();
	}

	/**
	 * Get webhook loading state
	 */
	get isWebhookLoading$(): Observable<boolean> {
		return this._isWebhookLoading$.asObservable();
	}

	/**
	 * Get webhook error state
	 */
	get webhookError$(): Observable<string> {
		return this._webhookError$.asObservable();
	}

	/**
	 * Set triggers
	 */
	setTriggers(triggers: IZapierEndpoint[]): void {
		this._triggers$.next(triggers);
	}

	/**
	 * Set actions
	 */
	setActions(actions: IZapierEndpoint[]): void {
		this._actions$.next(actions);
	}

	/**
	 * Set loading state
	 */
	setLoading(loading: boolean): void {
		this._isLoading$.next(loading);
	}

	/**
	 * Set error state
	 */
	setError(error: string): void {
		this._error$.next(error);
	}

	/**
	 * Set webhooks
	 */
	setWebhooks(webhooks: IZapierWebhook[]): void {
		this._webhooks$.next(webhooks);
	}

	/**
	 * Add a new webhook to the store
	 */
	addWebhook(webhook: IZapierWebhook): void {
		const currentWebhooks = this._webhooks$.getValue();
		this._webhooks$.next([...currentWebhooks, webhook]);
	}

	/**
	 * Remove a webhook from the store
	 */
	removeWebhook(webhookId: string): void {
		const currentWebhooks = this._webhooks$.getValue();
		this._webhooks$.next(currentWebhooks.filter((webhook) => webhook.id !== webhookId));
	}

	/**
	 * Set webhook loading state
	 */
	setWebhookLoading(loading: boolean): void {
		this._isWebhookLoading$.next(loading);
	}

	/**
	 * Set webhook error state
	 */
	setWebhookError(error: string): void {
		this._webhookError$.next(error);
	}

	/**
	 * Clear error state
	 */
	clearError(): void {
		this._error$.next(null);
	}

	/**
	 * Clear webhook error state
	 */
	clearWebhookError(): void {
		this._webhookError$.next(null);
	}

	/**
	 * Reset store state
	 */
	reset(): void {
		this._triggers$.next([]);
		this._actions$.next([]);
		this._isLoading$.next(false);
		this._error$.next(null);
		this._webhooks$.next([]);
		this._isWebhookLoading$.next(false);
		this._webhookError$.next(null);
	}
}
