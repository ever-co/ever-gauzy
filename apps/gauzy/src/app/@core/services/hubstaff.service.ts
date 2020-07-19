import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import {
	IIntegrationTenant,
	IIntegrationSetting,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationEntitySetting,
	DefaultValueDateTypeEnum,
	IIntegrationMap,
	IntegrationEntity
} from '@gauzy/models';
import { v4 as uuid } from 'uuid';
import { Store } from './store.service';
import { switchMap, tap } from 'rxjs/operators';
import { environment } from 'apps/gauzy/src/environments/environment';
import { cloneDeep } from 'lodash';
import * as moment from 'moment';

const TODAY = new Date();

const DEFAULT_DATE_RANGE = {
	start: new Date(
		moment()
			.subtract(7, 'days')
			.format('YYYY-MM-DD')
	),
	end: TODAY
};

interface IEntitiesSettings {
	previousValue: IIntegrationEntitySetting[];
	currentValue: IIntegrationEntitySetting[];
}

interface IDateRangeActivityFilter {
	start: Date;
	end: Date;
}

@Injectable({
	providedIn: 'root'
})
export class HubstaffService {
	private ACCESS_TOKEN: string;
	private _entitiesToSync$: BehaviorSubject<
		IEntitiesSettings
	> = new BehaviorSubject({
		previousValue: [],
		currentValue: []
	});
	private _dateRangeActivity$: BehaviorSubject<
		IDateRangeActivityFilter
	> = new BehaviorSubject(DEFAULT_DATE_RANGE);

	public entitiesToSync$: Observable<
		IEntitiesSettings
	> = this._entitiesToSync$.asObservable();

	public dateRangeActivity$: Observable<
		IDateRangeActivityFilter
	> = this._dateRangeActivity$.asObservable();

	integrationId: string;

	constructor(private _http: HttpClient, private _store: Store) {}

	getIntegration(integrationId): Observable<IIntegrationEntitySetting[]> {
		const data = JSON.stringify({
			relations: ['integration']
		});
		return this._http
			.get<any>(`/api/integration-entity-setting/${integrationId}`, {
				params: { data }
			})
			.pipe(tap(({ items }) => this._setSettingsValue(items)));
	}

	resetSettings() {
		const settingsData = this._entitiesToSync$.getValue();
		const revertData = {
			...settingsData,
			currentValue: cloneDeep(settingsData.previousValue)
		};

		this._entitiesToSync$.next(revertData);
	}

	private _setSettingsValue(items) {
		this._entitiesToSync$.next({
			previousValue: cloneDeep(items),
			currentValue: items
		});
	}

	updateSettings(integrationId): Observable<IIntegrationEntitySetting[]> {
		const settingsData = this._entitiesToSync$.getValue();

		return this._http
			.put<IIntegrationEntitySetting[]>(
				`/api/integration-entity-setting/${integrationId}`,
				settingsData.currentValue
			)
			.pipe(
				tap((entitySettings) => this._setSettingsValue(entitySettings))
			);
	}

	getToken(integrationId: string): Observable<IIntegrationSetting> {
		this.integrationId = integrationId;
		return this._http
			.get<IIntegrationSetting>(
				`/api/integrations/hubstaff/get-token/${integrationId}`
			)
			.pipe(
				tap(({ settingsValue }) => (this.ACCESS_TOKEN = settingsValue))
			);
	}

	refreshToken() {
		return this._http
			.get<any>(
				`/api/integrations/hubstaff/refresh-token/${this.integrationId}`
			)
			.pipe(
				tap(({ access_token }) => (this.ACCESS_TOKEN = access_token))
			);
	}

	authorizeClient(client_id: string): void {
		localStorage.setItem('client_id', client_id);
		const url = `https://account.hubstaff.com/authorizations/new?response_type=code&redirect_uri=${
			environment.HUBSTAFF_REDIRECT_URI
		}&realm=hubstaff&client_id=${client_id}&scope=hubstaff:read&state=oauth2&nonce=${uuid()}`;

		window.location.replace(url);
	}

	addIntegration(
		code: string,
		client_secret: string
	): Observable<IIntegrationTenant> {
		const client_id = localStorage.getItem('client_id');

		const getAccessTokensDto = {
			client_id,
			code,
			redirect_uri: environment.HUBSTAFF_REDIRECT_URI,
			client_secret
		};

		return this._store.selectedOrganization$.pipe(
			switchMap(({ tenantId }) =>
				this._http.post<IIntegrationTenant>(
					'/api/integrations/hubstaff/add-integration',
					{
						...getAccessTokensDto,
						tenantId
					}
				)
			)
		);
	}

	getOrganizations(integrationId): Observable<IHubstaffOrganization[]> {
		return this._http.post<IHubstaffOrganization[]>(
			`/api/integrations/hubstaff/organizations/${integrationId}`,
			{
				token: this.ACCESS_TOKEN
			}
		);
	}

	getProjects(organizationId, integrationId): Observable<IHubstaffProject[]> {
		return this._http.post<IHubstaffProject[]>(
			`/api/integrations/hubstaff/projects/${organizationId}`,
			{ token: this.ACCESS_TOKEN, integrationId }
		);
	}

	syncProjects(projects, integrationId, organizationId) {
		return this._http.post(
			`/api/integrations/hubstaff/sync-projects/${integrationId}`,
			{
				projects: this._mapNameAndSourceId(projects),
				orgId: organizationId
			}
		);
	}

	setActivityDateRange({ start, end }) {
		this._dateRangeActivity$.next({
			start: start || DEFAULT_DATE_RANGE.start,
			end: this._setEndDate(start)
		});
	}

	private _setEndDate(start) {
		const end = moment(start)
			.add(7, 'days')
			.toDate();
		return end > TODAY ? TODAY : end;
	}

	autoSync({ integrationId, hubstaffOrganizations, organizationId }) {
		const entitiesToSync = this._entitiesToSync$
			.getValue()
			.currentValue.filter((setting) => setting.sync);
		const dateRange = this._dateRangeActivity$.getValue();
		// organizations are already fetched ---> skip fetch for this just integrate in DB

		const organizationSetting = entitiesToSync.find(
			(setting) => setting.entity === IntegrationEntity.ORGANIZATION
		);

		// if organization is set to true, map all entities to this organizations, else use hubstaff organizations id and map all entities to current selected gauzy organization

		if (organizationSetting.sync) {
			const organizationsMap$ = this._http.post<IIntegrationMap[]>(
				`/api/integrations/hubstaff/sync-organizations/${integrationId}`,
				{
					organizations: hubstaffOrganizations.map(
						({ name, id }) => ({
							name,
							sourceId: id,
							currency: 'BGN',
							defaultValueDateType: DefaultValueDateTypeEnum.TODAY
						})
					)
				}
			);

			return organizationsMap$.pipe(
				switchMap((organizations) =>
					this._forkEntities(
						entitiesToSync,
						organizations,
						integrationId,
						dateRange
					)
				)
			);
		}

		return this._forkEntities(
			entitiesToSync,
			hubstaffOrganizations,
			integrationId,
			dateRange,
			organizationId
		);
	}

	private _forkEntities(
		entitiesToSync,
		organizations,
		integrationId,
		dateRange,
		organizationId?
	) {
		return forkJoin(
			organizations.map((organization) =>
				this._http.post(
					`/api/integrations/hubstaff/auto-sync/${integrationId}`,
					{
						entitiesToSync,
						dateRange,
						gauzyId: organizationId
							? organizationId
							: organization.gauzyId,
						sourceId: organization.sourceId
							? organization.sourceId
							: organization.id,
						token: this.ACCESS_TOKEN
					}
				)
			)
		);
	}

	private _mapNameAndSourceId(data: any[]) {
		return data.map(({ name, id }) => ({ name, sourceId: id }));
	}
}
