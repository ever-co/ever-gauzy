import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY } from 'rxjs';
import { tap, switchMap, map } from 'rxjs/operators';
import { ID, IOrganization, IMakeComApiConfig } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { MakeComService } from './make-com.service';

@Injectable({
	providedIn: 'root'
})
export class MakeComStoreService {
	private _config$: BehaviorSubject<IMakeComApiConfig | null> = new BehaviorSubject<IMakeComApiConfig | null>(null);
	private _selectedIntegrationId$: BehaviorSubject<ID | null> = new BehaviorSubject<ID | null>(null);
	private _webhooks$: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
	public webhooks$: Observable<any[]> = this._webhooks$.asObservable();

	private _scenarios$: BehaviorSubject<any[]> = new BehaviorSubject<any[]>([]);
	public scenarios$: Observable<any[]> = this._scenarios$.asObservable();

	constructor(
		private readonly _makeComService: MakeComService,
		private readonly _storeService: Store
	) {}

	/**
	 * Sets the selected integration ID.
	 * @param integrationId The ID of the integration to set.
	 */
	setSelectedIntegrationId(integrationId: ID): void {
		this._selectedIntegrationId$.next(integrationId);
	}

	/**
	 * Gets the configuration for Make.com API.
	 * @param input The input parameters to find the configuration.
	 * @returns An observable of the Make.com API configuration.
	 */
	getConfig(input: { integrationId: ID; organizationId: ID; tenantId: ID }): Observable<IMakeComApiConfig> {
		const { integrationId, organizationId, tenantId } = input;
		this.setSelectedIntegrationId(integrationId);

		const config$ = this._config$.getValue();
		if (config$) {
			return EMPTY;
		}

		const data = JSON.stringify({
			filter: { organizationId, tenantId }
		});

		return this._makeComService.getConfig({ integrationId, data }).pipe(
			tap((config) => this._config$.next(config))
		);
	}

	/**
	 * Gets the selected organization from the store.
	 * @returns The selected organization.
	 */
	getSelectedOrganization() {
		return this._storeService.selectedOrganization;
	}

	/**
	 * Loads webhooks for the current organization.
	 * @param organization The organization to load webhooks for.
	 * @returns An observable of webhooks.
	 */
	loadWebhooks(organization: IOrganization): Observable<any> {
		const { id: organizationId, tenantId } = organization;
		const integrationId = this._selectedIntegrationId$.getValue();

		const data = JSON.stringify({
			filter: { organizationId, tenantId }
		});

		return this._makeComService.getAllWebhooks({ integrationId, data }).pipe(
			map((response) => response.items),
			tap((webhooks) => this._webhooks$.next(webhooks))
		);
	}

	/**
	 * Loads scenarios for the current organization.
	 * @param organization The organization to load scenarios for.
	 * @returns An observable of scenarios.
	 */
	loadScenarios(organization: IOrganization): Observable<any> {
		const { id: organizationId, tenantId } = organization;
		const integrationId = this._selectedIntegrationId$.getValue();

		const data = JSON.stringify({
			filter: { organizationId, tenantId }
		});

		return this._makeComService.getAllScenarios({ integrationId, data }).pipe(
			map((response) => response.items),
			tap((scenarios) => this._scenarios$.next(scenarios))
		);
	}

	/**
	 * Creates a new webhook.
	 * @param webhookData The data for the new webhook.
	 * @returns An observable of the created webhook.
	 */
	createWebhook(webhookData: any): Observable<any> {
		const integrationId = this._selectedIntegrationId$.getValue();
		return this._makeComService.createWebhook({ integrationId, data: webhookData }).pipe(
			tap(() => {
				const organization = this.getSelectedOrganization();
				this.loadWebhooks(organization).subscribe();
			})
		);
	}

	/**
	 * Deletes a webhook.
	 * @param webhookId The ID of the webhook to delete.
	 * @returns An observable that completes after deletion.
	 */
	deleteWebhook(webhookId: string): Observable<any> {
		const integrationId = this._selectedIntegrationId$.getValue();
		return this._makeComService.deleteWebhook({ integrationId, webhookId }).pipe(
			tap(() => {
				const organization = this.getSelectedOrganization();
				this.loadWebhooks(organization).subscribe();
			})
		);
	}

	/**
	 * Creates a new scenario.
	 * @param scenarioData The data for the new scenario.
	 * @returns An observable of the created scenario.
	 */
	createScenario(scenarioData: any): Observable<any> {
		const integrationId = this._selectedIntegrationId$.getValue();
		return this._makeComService.createScenario({ integrationId, data: scenarioData }).pipe(
			tap(() => {
				const organization = this.getSelectedOrganization();
				this.loadScenarios(organization).subscribe();
			})
		);
	}

	/**
	 * Deletes a scenario.
	 * @param scenarioId The ID of the scenario to delete.
	 * @returns An observable that completes after deletion.
	 */
	deleteScenario(scenarioId: string): Observable<any> {
		const integrationId = this._selectedIntegrationId$.getValue();
		return this._makeComService.deleteScenario({ integrationId, scenarioId }).pipe(
			tap(() => {
				const organization = this.getSelectedOrganization();
				this.loadScenarios(organization).subscribe();
			})
		);
	}
}
