import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { tap, switchMap, map } from 'rxjs/operators';
import moment from 'moment';
import { IEngagement, IOrganization, IUpworkApiConfig, IUpworkDateRange } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';
import { UpworkService } from './upwork.service';

const TODAY = new Date();
const DEFAULT_DATE_RANGE = {
	start: new Date(moment().subtract(1, 'months').format('YYYY-MM-DD')),
	end: TODAY
};

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
			name: 'Report',
			key: 'report',
			relatedTo: ['Income', 'Expense'],
			sync: true,
			datePicker: {
				max: new Date(),
				selectedDate: new Date()
			}
		},
		{
			name: 'Proposal',
			key: 'proposal',
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
	private _config$: BehaviorSubject<IUpworkApiConfig> = new BehaviorSubject(null);

	private _contracts$: BehaviorSubject<IEngagement[]> = new BehaviorSubject(null);
	public contracts$: Observable<IEngagement[]> = this._contracts$.asObservable();

	private _selectedIntegrationId$: BehaviorSubject<string> = new BehaviorSubject(null);

	private _contractsSettings$: BehaviorSubject<any> = new BehaviorSubject(contractSettings);
	public contractsSettings$: Observable<any> = this._contractsSettings$.asObservable();

	private employeeId: string;

	private _dateRangeActivity$: BehaviorSubject<IUpworkDateRange> = new BehaviorSubject(DEFAULT_DATE_RANGE);
	public dateRangeActivity$: Observable<IUpworkDateRange> = this._dateRangeActivity$.asObservable();

	private _reports$: BehaviorSubject<any[]> = new BehaviorSubject(null);
	public reports$: Observable<any> = this._reports$.asObservable();

	constructor(private _upworkService: UpworkService, private _storeService: Store) {}

	getContracts(): Observable<IEngagement[]> {
		const contracts$ = this._contracts$.getValue();
		if (contracts$) {
			return EMPTY;
		}
		return this._config$.pipe(
			switchMap((config) => (config ? this._upworkService.getContracts(config) : EMPTY)),
			tap((contracts) => this._contracts$.next(contracts))
		);
	}

	/**
	 * Get upwork income/expense reports
	 */
	loadReports(organization: IOrganization): Observable<any> {
		const { id: organizationId, tenantId } = organization;
		const relations: object = {
			income: ['employee', 'employee.user'],
			expense: ['employee', 'employee.user', 'vendor', 'category']
		};
		const dateRange = this._dateRangeActivity$.getValue();
		const integrationId = this._selectedIntegrationId$.getValue();
		const data = JSON.stringify({
			relations,
			filter: { dateRange, ...{ organizationId, tenantId } }
		});

		return this._upworkService.getAllReports({ integrationId, data }).pipe(
			map((reports) => reports.items),
			tap((reports) => this._reports$.next(reports))
		);
	}

	setSelectedIntegrationId(integrationId) {
		this._selectedIntegrationId$.next(integrationId);
	}

	syncContracts(contracts) {
		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId } = this.getSelectedOrganization();
		return this._upworkService.syncContracts({
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
		const entitiesToSync = settings.entitiesToSync.filter((entity) => entity.sync);
		if (!entitiesToSync.length) {
			return;
		}

		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId } = this.getSelectedOrganization();

		//map contract provider to get authorize info
		const { provider__reference: providerReferenceId, provider__id: providerId } = contracts.find(
			(contract: IEngagement) => true
		);

		return this._upworkService.syncContractsRelatedData({
			integrationId,
			organizationId,
			contracts,
			entitiesToSync,
			config,
			employeeId: this.employeeId,
			providerId,
			providerReferenceId
		});
	}

	setSelectedEmployeeId(employeeId: string) {
		this.employeeId = employeeId;
	}

	setFilterDateRange({ start, end }: IUpworkDateRange) {
		this._dateRangeActivity$.next({
			start: start || DEFAULT_DATE_RANGE.start,
			end: end || DEFAULT_DATE_RANGE.end
		});
	}

	getConfig(findInput): Observable<IUpworkApiConfig> {
		const { integrationId, organizationId, tenantId } = findInput;
		this.setSelectedIntegrationId(integrationId);
		const config$ = this._config$.getValue();
		if (config$) {
			return EMPTY;
		}
		const data = JSON.stringify({
			filter: { ...{ organizationId, tenantId } }
		});
		return this._upworkService.getConfig({ integrationId, data }).pipe(tap((config) => this._config$.next(config)));
	}

	/*
	 * Get selected organization from header dropdown
	 */
	getSelectedOrganization() {
		return this._storeService.selectedOrganization;
	}
}
