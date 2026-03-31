import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ISimExecutionRecord } from './sim.service';

@Injectable({ providedIn: 'root' })
export class SimStoreService {
	// Selected integration tenant ID
	private readonly _selectedIntegrationId$ = new BehaviorSubject<string | null>(null);
	public selectedIntegrationId$: Observable<string | null> = this._selectedIntegrationId$.asObservable();

	// Execution history
	private readonly _executions$ = new BehaviorSubject<ISimExecutionRecord[]>([]);
	public executions$: Observable<ISimExecutionRecord[]> = this._executions$.asObservable();

	setSelectedIntegrationId(id: string | null): void {
		this._selectedIntegrationId$.next(id);
	}

	setExecutions(executions: ISimExecutionRecord[]): void {
		this._executions$.next(executions);
	}

	reset(): void {
		this._selectedIntegrationId$.next(null);
		this._executions$.next([]);
	}
}
