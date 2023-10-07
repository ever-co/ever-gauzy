import { Component, OnInit, forwardRef, OnDestroy, AfterViewInit, Input, Output, EventEmitter } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubRepository, IGithubRepositoryResponse, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, GithubService, Store } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-github-repository-selector',
	templateUrl: './repository-selector.component.html',
	styleUrls: ['./repository-selector.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => RepositorySelectorComponent),
			multi: true
		}
	]
})
export class RepositorySelectorComponent implements AfterViewInit, OnInit, OnDestroy {

	private subject$: Subject<IIntegrationTenant> = new Subject<IIntegrationTenant>();

	public organization: IOrganization = this._store.selectedOrganization;
	public loading: boolean;
	/** */
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;

	/** Getter & Setter */
	private _integration: IIntegrationTenant;
	// Getter for the integration property as an Observable
	get integration(): IIntegrationTenant {
		return this._integration;
	}
	// Setter for the integration property
	@Input() set integration(value: IIntegrationTenant) {
		if (value) {
			this._integration = value;
			this.subject$.next(value); // Emit the updated value to observers
		}
	}

	/** */
	@Output() onChanged = new EventEmitter<IGithubRepository>();
	@Output() afterLoad = new EventEmitter<IGithubRepository[]>();

	constructor(
		private readonly _store: Store,
		private readonly _githubService: GithubService,
		private readonly _errorHandlingService: ErrorHandlingService,
	) {
		this.subject$
			.pipe(
				tap(() => this.getRepositories()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnInit(): void { }

	ngAfterViewInit(): void { }

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
		const { id: integrationId } = this.integration;

		this.repositories$ = this._githubService.getRepositories(integrationId, {
			organizationId,
			tenantId
		}).pipe(
			map(({ repositories }: IGithubRepositoryResponse) => repositories),
			// Update component state with fetched repositories
			tap((repositories: IGithubRepository[]) => {
				this.repositories = repositories;
				this.afterLoad.emit(this.repositories || []);
			}),
			catchError((error) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of([]);
			}),
			finalize(() => {
				this.loading = false;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
		);
	}

	/**
	 * Selects a GitHub repository and retrieves its associated issues.
	 * @param repository - The GitHub repository to select.
	 */
	public selectRepository(repository: IGithubRepository) {
		this.onChanged.emit(repository);
	}

	ngOnDestroy(): void { }
}
