import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SimStoreService {
	// Selected integration tenant ID
	private _selectedIntegrationId$ = new BehaviorSubject<string | null>(null);
	public selectedIntegrationId$: Observable<string | null> = this._selectedIntegrationId$.asObservable();

	// Execution history
	private _executions$ = new BehaviorSubject<any[]>([]);
	public executions$: Observable<any[]> = this._executions$.asObservable();

	// Integration enabled state
	private _isEnabled$ = new BehaviorSubject<boolean>(false);
	public isEnabled$: Observable<boolean> = this._isEnabled$.asObservable();

	// Loading state
	private _isLoading$ = new BehaviorSubject<boolean>(false);
	public isLoading$: Observable<boolean> = this._isLoading$.asObservable();

	// Error state
	private _error$ = new BehaviorSubject<string | null>(null);
	public error$: Observable<string | null> = this._error$.asObservable();

	setSelectedIntegrationId(id: string | null): void {
		this._selectedIntegrationId$.next(id);
	}

	setExecutions(executions: any[]): void {
		this._executions$.next(executions);
	}

	setEnabled(enabled: boolean): void {
		this._isEnabled$.next(enabled);
	}

	setLoading(loading: boolean): void {
		this._isLoading$.next(loading);
	}

	setError(error: string | null): void {
		this._error$.next(error);
	}

	reset(): void {
		this._selectedIntegrationId$.next(null);
		this._executions$.next([]);
		this._isEnabled$.next(false);
		this._isLoading$.next(false);
		this._error$.next(null);
	}
}
