import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubRepository, IIntegrationSetting, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	ErrorHandlingService,
	GithubService,
	IntegrationsService,
	Store
} from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './view.component.html'
})
export class GithubViewComponent implements OnInit {

	public organization: IOrganization;
	public loading: boolean = true;
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _githubService: GithubService,
	) { }

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.getRepositories()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	async getRepositories() {
		if (!this.organization) {
			return;
		}

		const integrationId = this._activatedRoute.snapshot.paramMap.get('integrationId');
		const { id: organizationId, tenantId } = this.organization;

		this.repositories$ = this._integrationsService.fetchIntegrationTenant(integrationId, {
			relations: ['settings']
		}).pipe(
			filter((integration: IIntegrationTenant) => !!integration.id),
			filter(({ settings }: IIntegrationTenant) => !!settings),
			map(({ settings }: IIntegrationTenant) => {
				const setting: IIntegrationSetting = settings.find(
					(setting: IIntegrationSetting) => setting.settingsName === 'installation_id'
				);
				const installation_id = setting.settingsValue;
				return installation_id;
			}),
			switchMap((installation_id) => this._githubService.getRepositories(
				installation_id,
				{ organizationId, tenantId }
			)),
			map(({ repositories }) => {
				this.repositories = repositories;
				return repositories;
			}),
			untilDestroyed(this),
			catchError((error) => {
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			finalize(() => (this.loading = false)),
		);
	}
}
