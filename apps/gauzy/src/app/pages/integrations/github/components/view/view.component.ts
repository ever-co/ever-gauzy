import { AfterViewInit, Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Data } from '@angular/router';
import { debounceTime, mergeMap, of } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubIssue, IGithubRepository, IGithubRepositoryResponse, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import {
	ErrorHandlingService,
	GithubService,
	Store
} from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [
		TitleCasePipe
	]
})
export class GithubViewComponent extends TranslationBaseComponent implements AfterViewInit, OnInit {

	public settingsSmartTable: object;
	public organization: IOrganization;
	public loading: boolean;
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;
	public issues$: Observable<any[]>;
	public issues: any[] = [];

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _titlecasePipe: TitleCasePipe,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _store: Store,
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
	 * Fetches repositories for a given integration and organization.
	 */
	private getRepositories() {
		// Ensure there is a valid organization
		if (!this.organization) {
			return;
		}

		this.loading = true;

		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;
		this.repositories$ = this._activatedRoute.parent.data.pipe(
			filter(({ integration }: Data) => !!integration),
			switchMap(() => this._activatedRoute.params.pipe(
				filter(({ integrationId }) => integrationId)
			)),
			// Get the 'integrationId' route parameter
			switchMap(({ integrationId }) => this._githubService.getRepositories(integrationId, {
				organizationId,
				tenantId
			})),
			// Update component state with fetched repositories
			tap(({ repositories }: IGithubRepositoryResponse) => {
				this.repositories = repositories;
			}),
			map(({ repositories }) => repositories),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			tap(() => {
				this.loading = false;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
		);
	}

	/**
	 *
	 * @param repository
	 */
	selectRepository(repository: IGithubRepository) {
		this.issues$ = repository ? this.getRepositoryIssue(repository) : of([]);
	}

	/**
	 *
	 * @param repository
	 * @returns
	 */
	private getRepositoryIssue(repository: IGithubRepository) {
		// Ensure there is a valid organization
		if (!this.organization) {
			return;
		}
		const owner = repository.owner['login'];
		const repo = repository.name;

		this.loading = true;
		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;
		return this._activatedRoute.params.pipe(
			// Get the 'integrationId' route parameter
			switchMap(({ integrationId }) => {
				return this._githubService.getRepositoryIssues(integrationId, owner, repo, {
					organizationId,
					tenantId,
				});
			}),
			// Update component state with fetched issues
			tap((issues: IGithubIssue[]) => {
				this.issues = issues;
			}),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			tap(() => {
				this.loading = false;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
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
				number: {
					title: this.getTranslation('SM_TABLE.NUMBER'),
					type: 'number',
					valuePrepareFunction: (data: string) => {
						console.log(data);
						return data;
					}
				},
				title: {
					title: this.getTranslation('SM_TABLE.TITLE'),
					type: 'string'
				},
				state: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'string',
					valuePrepareFunction: (data: string) => {
						return this._titlecasePipe.transform(data);
					}
				}
			}
		};
	}
}
