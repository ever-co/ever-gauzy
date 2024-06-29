import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { tap, switchMap, map } from 'rxjs/operators';
import * as moment from 'moment';
import { ID, IEngagement, IOrganization, IUpworkApiConfig, IUpworkDateRange } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/common';
import { UpworkService } from './upwork.service';

const DEFAULT_DATE_RANGE = {
	start: new Date(moment().subtract(1, 'months').format('YYYY-MM-DD')),
	end: new Date()
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

	private _contracts$: BehaviorSubject<IEngagement[]> = new BehaviorSubject([]);
	public contracts$: Observable<IEngagement[]> = this._contracts$.asObservable();

	private _selectedIntegrationId$: BehaviorSubject<string> = new BehaviorSubject(null);

	private _contractsSettings$: BehaviorSubject<any> = new BehaviorSubject(contractSettings);
	public contractsSettings$: Observable<any> = this._contractsSettings$.asObservable();

	private employeeId: ID;

	private _dateRangeActivity$: BehaviorSubject<IUpworkDateRange> = new BehaviorSubject(DEFAULT_DATE_RANGE);
	public dateRangeActivity$: Observable<IUpworkDateRange> = this._dateRangeActivity$.asObservable();

	private _reports$: BehaviorSubject<any[]> = new BehaviorSubject(null);
	public reports$: Observable<any> = this._reports$.asObservable();

	constructor(private readonly _upworkService: UpworkService, private readonly _storeService: Store) {}

	/**
	 * Retrieves contracts from Upwork service.
	 *
	 * @returns An observable stream of IEngagement[] representing contracts.
	 */
	getContracts(): Observable<IEngagement[]> {
		const contracts$ = this._contracts$.getValue();
		if (contracts$) {
			return EMPTY; // Return empty observable if contracts$ already has a value
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

	/**
	 * Sets the selected integration ID.
	 * @param integrationId The ID of the integration to set.
	 */
	setSelectedIntegrationId(integrationId: ID): void {
		this._selectedIntegrationId$.next(integrationId);
	}

	/**
	 * Syncs contracts with Upwork.
	 * @param contracts The contracts to sync.
	 * @returns An observable that completes after syncing contracts.
	 */
	syncContracts(contracts: IEngagement[]) {
		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId, tenantId } = this.getSelectedOrganization();

		return this._upworkService.syncContracts({
			integrationId,
			organizationId,
			tenantId,
			contracts,
			employeeId: this.employeeId
		});
	}

	/**
	 * Syncs data related to contracts with Upwork.
	 * @param contracts The contracts to sync data for.
	 * @returns An observable that completes after syncing data related to contracts.
	 */
	syncDataWithContractRelated(contracts: IEngagement[]): Observable<any> {
		const config = this._config$.getValue();
		const settings = this._contractsSettings$.getValue();

		if (settings.onlyContracts) {
			return this.syncContracts(contracts);
		}

		const entitiesToSync = settings.entitiesToSync.filter((entity) => entity.sync);
		if (!entitiesToSync.length) {
			return EMPTY;
		}

		const integrationId = this._selectedIntegrationId$.getValue();
		const { id: organizationId, tenantId } = this.getSelectedOrganization();

		const { provider__reference: providerReferenceId, provider__id: providerId } = contracts.find(
			(contract: IEngagement) => true // Modify condition based on your logic to find provider details
		);

		return this._upworkService.syncContractsRelatedData({
			integrationId,
			organizationId,
			tenantId,
			contracts,
			entitiesToSync,
			config,
			employeeId: this.employeeId,
			providerId,
			providerReferenceId
		});
	}

	/**
	 * Sets the selected employee ID.
	 * @param employeeId The ID of the employee to set.
	 */
	setSelectedEmployeeId(employeeId: ID) {
		this.employeeId = employeeId;
	}

	/**
	 * Sets the filter date range for Upwork activities.
	 * @param dateRange The date range to set.
	 */
	setFilterDateRange(dateRange: IUpworkDateRange): void {
		const { start, end } = dateRange;

		this._dateRangeActivity$.next({
			start: start || DEFAULT_DATE_RANGE.start,
			end: end || DEFAULT_DATE_RANGE.end
		});
	}

	/**
	 * Gets the configuration for Upwork API.
	 * @param input The input parameters to find the configuration.
	 * @returns An observable of the Upwork API configuration.
	 */
	getConfig(input): Observable<IUpworkApiConfig> {
		const { integrationId, organizationId, tenantId } = input;
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
