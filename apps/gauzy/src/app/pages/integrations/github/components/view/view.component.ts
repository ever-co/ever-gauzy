import { AfterViewInit, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubRepository, IIntegrationSetting, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	ErrorHandlingService,
	GithubService,
	IntegrationsService,
	Store
} from './../../../../../@core/services';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './view.component.html'
})
export class GithubViewComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

	public settingsSmartTable: object;
	public organization: IOrganization;
	public loading: boolean = true;
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;
	public issues$: Observable<any[]>;
	public issues: any[] = [];

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
		private readonly _integrationsService: IntegrationsService,
		private readonly _githubService: GithubService,
	) {
		super(_translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit(): void {
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

	/**
	 *
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			selectedRowIndex: -1,
			selectMode: 'multi',
			actions: {
				add: false,
				edit: false,
				delete: false,
				select: true
			},
			columns: {
				name: {
					title: this.getTranslation('SM_TABLE.NAME'),
					type: 'string'
				},
				description: {
					title: this.getTranslation('SM_TABLE.DESCRIPTION'),
					type: 'string'
				}
			}
		};
	}
}
