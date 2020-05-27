import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { IEngagement, IUpworkApiConfig } from '@gauzy/models';
import { UpworkService } from './upwork.service';
import { tap, switchMap } from 'rxjs/operators';
import { Store } from './store.service';

@Injectable({
	providedIn: 'root',
})
export class UpworkStoreService {
	private _config$: BehaviorSubject<IUpworkApiConfig> = new BehaviorSubject(
		null
	);

	private _contracts$: BehaviorSubject<IEngagement[]> = new BehaviorSubject(
		null
	);
	public contracts$: Observable<
		IEngagement[]
	> = this._contracts$.asObservable();

	private _workDays$: BehaviorSubject<any[]> = new BehaviorSubject(null);
	public workDays$: Observable<any[]> = this._workDays$.asObservable();

	private _selectedIntegrationId$: BehaviorSubject<
		string
	> = new BehaviorSubject(null);

	constructor(private _us: UpworkService, private _os: Store) {}

	getContracts(): Observable<IEngagement[]> {
		const contracts$ = this._contracts$.getValue();
		if (contracts$) {
			return EMPTY;
		}
		return this._config$.pipe(
			switchMap((config) =>
				config ? this._us.getContracts(config) : EMPTY
			),
			tap((contracts) => this._contracts$.next(contracts))
		);
	}

	setSelectedIntegrationId(integrationId) {
		this._selectedIntegrationId$.next(integrationId);
	}

	// upwork contract can be represented as gauzy project
	syncContracts(contracts) {
		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId } = this._os.selectedOrganization;
		return this._us.syncContracts({
			integrationId,
			organizationId,
			contracts,
		});
	}

	getConfig(integrationId): Observable<IUpworkApiConfig> {
		this.setSelectedIntegrationId(integrationId);
		const config$ = this._config$.getValue();
		if (config$) {
			return EMPTY;
		}
		return this._us
			.getConfig(integrationId)
			.pipe(tap((config) => this._config$.next(config)));
	}
}
