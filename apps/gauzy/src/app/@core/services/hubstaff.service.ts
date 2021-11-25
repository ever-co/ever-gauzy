import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, debounceTime } from 'rxjs';
import {
	IIntegrationTenant,
	IIntegrationSetting,
	IHubstaffOrganization,
	IHubstaffProject,
	IIntegrationEntitySetting,
	DefaultValueDateTypeEnum,
	IIntegrationMap,
	IntegrationEntity,
	IntegrationEnum,
	IDateRangeActivityFilter,
	IEntitySettingToSync
} from '@gauzy/contracts';
import { v4 as uuid } from 'uuid';
import { switchMap, tap } from 'rxjs/operators';
import { clone } from 'underscore';
import * as moment from 'moment';
import { environment } from './../../../environments/environment';
import { API_PREFIX } from '../constants/app.constants';

const TODAY = new Date();

const DEFAULT_DATE_RANGE = {
	start: new Date(moment().subtract(6, 'days').format('YYYY-MM-DD')),
	end: new Date(moment().add(1, 'days').format('YYYY-MM-DD'))
};

@Injectable({
	providedIn: 'root'
})
export class HubstaffService {
	
	private ACCESS_TOKEN: string;
	private _entitiesToSync$: BehaviorSubject<IEntitySettingToSync> = new BehaviorSubject({
		previousValue: [],
		currentValue: []
	});
	private _dateRangeActivity$: BehaviorSubject<IDateRangeActivityFilter> = new BehaviorSubject(
		DEFAULT_DATE_RANGE
	);

	public entitiesToSync$: Observable<IEntitySettingToSync> = this._entitiesToSync$.asObservable();

	public dateRangeActivity$: Observable<IDateRangeActivityFilter> = this._dateRangeActivity$.asObservable();

	integrationId: string;

	constructor(
		private readonly _http: HttpClient
	) {}

	getIntegration(integrationId): Observable<IIntegrationEntitySetting[]> {
		const data = JSON.stringify({
			relations: ['integration']
		});
		return this._http
			.get<any>(
				`${API_PREFIX}/integration-entity-setting/integration/${integrationId}`,
				{
					params: { data }
				}
			)
			.pipe(tap(({ items }) => this._setSettingsValue(items)));
	}

	resetSettings() {
		const settings = this._entitiesToSync$.getValue();
		this._entitiesToSync$.next({
			...settings,
			currentValue: clone(settings.previousValue)
		});
	}

	private _setSettingsValue(items) {
		this._entitiesToSync$.next({
			previousValue: clone(items),
			currentValue: items
		});
	}

	updateSettings(integrationId): Observable<IIntegrationEntitySetting[]> {
		const { currentValue } = this._entitiesToSync$.getValue();
		return this._http
			.put<IIntegrationEntitySetting[]>(
				`${API_PREFIX}/integration-entity-setting/integration/${integrationId}`,
				currentValue
			)
			.pipe(
				tap((entitySettings) => this._setSettingsValue(entitySettings))
			);
	}

	getToken(integrationId: string): Observable<IIntegrationSetting> {
		this.integrationId = integrationId;
		return this._http
			.get<IIntegrationSetting>(
				`${API_PREFIX}/integrations/hubstaff/token/${integrationId}`
			)
			.pipe(
				tap(({ settingsValue }) => (this.ACCESS_TOKEN = settingsValue))
			);
	}

	refreshToken() {
		return this._http
			.get<any>(
				`${API_PREFIX}/integrations/hubstaff/refresh-token/${this.integrationId}`
			)
			.pipe(
				tap(({ access_token }) => (this.ACCESS_TOKEN = access_token))
			);
	}

	authorizeClient(client_id: string): void {
		const url = `https://account.hubstaff.com/authorizations/new?response_type=code&redirect_uri=${
			environment.HUBSTAFF_REDIRECT_URI
		}&realm=hubstaff&client_id=${client_id}&scope=hubstaff:read&state=${client_id}&nonce=${uuid()}`;

		window.location.replace(url);
	}

	addIntegration({
		code,
		client_secret,
		client_id,
		organizationId
	}): Observable<IIntegrationTenant> {
		const getAccessTokensDto = {
			client_id,
			code,
			redirect_uri: environment.HUBSTAFF_REDIRECT_URI,
			client_secret,
			organizationId
		};

		return this._http.post<IIntegrationTenant>(
			`${API_PREFIX}/integrations/hubstaff/integration`,
			{ ...getAccessTokensDto }
		);
	}

	getOrganizations(integrationId): Observable<IHubstaffOrganization[]> {
		return this._http.post<IHubstaffOrganization[]>(
			`${API_PREFIX}/integrations/hubstaff/organizations/${integrationId}`,
			{
				token: this.ACCESS_TOKEN
			}
		);
	}

	getProjects(organizationId, integrationId): Observable<IHubstaffProject[]> {
		return this._http.post<IHubstaffProject[]>(
			`${API_PREFIX}/integrations/hubstaff/projects/${organizationId}`,
			{ token: this.ACCESS_TOKEN, integrationId }
		);
	}

	syncProjects(projects, integrationId, organizationId) {
		return this._http.post(`${API_PREFIX}/integrations/hubstaff/sync-projects/${integrationId}`, {
			projects: this._mapProjectPayload(projects),
			organizationId,
			token: this.ACCESS_TOKEN
		});
	}

	setActivityDateRange({ start, end }) {
		this._dateRangeActivity$.next({
			start: start || DEFAULT_DATE_RANGE.start,
			end: this._setEndDate(start)
		});
	}

	private _setEndDate(start) {
		const end = moment(start).add(7, 'days').toDate();
		return end > TODAY ? TODAY : end;
	}

	autoSync({ integrationId, hubstaffOrganizations, organizationId }) {
		const dateRange = this._dateRangeActivity$.getValue();

		// organizations are already fetched ---> skip fetch for this just integrate in DB
		const organizationEntityToSync = this._entitiesToSync$
			.getValue()
			.currentValue
			.filter((setting) => setting.sync)
			.find((setting) => setting.entity === IntegrationEntity.ORGANIZATION)
			
		// if organization is set to true, map all entities to this organizations, else use hubstaff organizations id and map all entities to current selected gauzy organization
		if (
			organizationEntityToSync &&
			organizationEntityToSync.sync
		) {
			const organizationsMap$ = this._http.post<IIntegrationMap[]>(
				`${API_PREFIX}/integrations/hubstaff/sync-organizations/${integrationId}`,
				{
					organizations: hubstaffOrganizations.map(
						({ name, id }) => ({
							name,
							sourceId: id,
							currency: environment.DEFAULT_CURRENCY,
							defaultValueDateType: DefaultValueDateTypeEnum.TODAY
						})
					)
				}
			);

			return organizationsMap$.pipe(
				debounceTime(1000),
				switchMap((organizations) =>
					this._forkEntities(
						organizations,
						integrationId,
						dateRange
					)
				)
			);
		}

		return this._forkEntities(
			hubstaffOrganizations,
			integrationId,
			dateRange,
			organizationId
		);
	}

	private _forkEntities(
		organizations,
		integrationId,
		dateRange,
		organizationId?
	) {
		return forkJoin(
			organizations.filter((organization) => organization.sourceId != 79548).map((organization) =>
				this._http.post(
					`${API_PREFIX}/integrations/hubstaff/auto-sync/${integrationId}`,
					{
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
		)
		.pipe(debounceTime(2000));
	}

	private _mapProjectPayload(data: any[]) {
		return data.map(
			({ name, id, billable, description, client_id = null }) => ({
				name,
				sourceId: id,
				billable,
				description,
				client_id
			})
		);
	}

	/*
	 * Check remeber state for upwork integration
	 */
	checkRemeberState(organizationId: string) {
		return this._http.get<any>(
			`${API_PREFIX}/integration/check/state/${IntegrationEnum.HUBSTAFF}/${organizationId}`
		);
	}
}
