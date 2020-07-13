import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { IEngagement, IUpworkApiConfig } from '@gauzy/models';
import { UpworkService } from './upwork.service';
import { tap, switchMap } from 'rxjs/operators';
import { Store } from './store.service';

const contractSettings = {
	entitiesToSync: [
		{
			name: 'Work Diary',
			key: 'workDiary',
			relatedTo: ['TimeSlot', 'TimeLog', 'Timesheet', 'User'],
			sync: true,
			datePicker: {
				max: new Date(),
				selectedDate: new Date()
			}
		},
		{
			name: 'Reports',
			key: 'reports',
			relatedTo: [],
			sync: true,
			datePicker: {
				max: new Date(),
				selectedDate: new Date()
			}
		}
	],
	onlyContracts: false
};

@Injectable({
	providedIn: 'root'
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

	private _selectedIntegrationId$: BehaviorSubject<
		string
	> = new BehaviorSubject(null);

	private _contractsSettings$: BehaviorSubject<any> = new BehaviorSubject(
		contractSettings
	);
	public contractsSettings$: Observable<
		any
	> = this._contractsSettings$.asObservable();

	private employeeId: string;

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

	syncContracts(contracts) {
		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId } = this._os.selectedOrganization;
		return this._us.syncContracts({
			integrationId,
			organizationId,
			contracts,
			employeeId: this.employeeId
		});
	}

	syncDataWithContractRelated(contracts) {
		const config = this._config$.getValue();
		const settings = this._contractsSettings$.getValue();
		if (settings.onlyContracts) {
			return this.syncContracts(contracts);
		}
		const entitiesToSync = settings.entitiesToSync.filter(
			(entity) => entity.sync
		);
		if (!entitiesToSync.length) {
			return;
		}

		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId } = this._os.selectedOrganization;

		//map contract provider to get authorize info
		const {
			provider__reference: providerRefernceId,
			provider__id: providerId
		} = contracts.find((contract: IEngagement) => true);

		return this._us.syncContractsRelatedData({
			integrationId,
			organizationId,
			contracts,
			entitiesToSync,
			config,
			employeeId: this.employeeId,
			providerId,
			providerRefernceId
		});
	}

	setSelectedEmployeeId(employeeId) {
		this.employeeId = employeeId;
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
