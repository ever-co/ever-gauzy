import { Component, OnInit, forwardRef, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubRepository, IGithubRepositoryResponse, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, GithubService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/common';

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
export class RepositorySelectorComponent implements OnInit, OnDestroy {
	public preSelected: boolean = false;
	public loading: boolean = false;
	private subject$: Subject<IIntegrationTenant> = new Subject<IIntegrationTenant>();
	public organization: IOrganization = this._store.selectedOrganization;
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	_placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/** Getter & Setter */
	private _selected: boolean = false;
	get selected(): boolean {
		return this._selected;
	}
	@Input() set selected(value: boolean) {
		this._selected = value;
	}

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

	// Implement your onChange and onTouched methods
	onChange: (value: IGithubRepository['id']) => void = () => {};
	onTouched: (value: IGithubRepository['id']) => void = () => {};

	// Define the getter and setter for the repository
	private _sourceId: IGithubRepository['id'];
	get sourceId(): IGithubRepository['id'] {
		return this._sourceId;
	}
	@Input() set sourceId(val: IGithubRepository['id']) {
		if (val) {
			this._sourceId = val;
			this.onChange(val);
			this.onTouched(val);

			/** Pre Selected Repository */
			if (this.selected) {
				this._preSelectedRepository(this._sourceId);
			}
		}
	}

	/** */
	@Output() onChanged = new EventEmitter<IGithubRepository>();
	@Output() afterLoad = new EventEmitter<IGithubRepository[]>();

	constructor(
		private readonly _store: Store,
		private readonly _githubService: GithubService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		this.subject$
			.pipe(
				tap(() => this._getRepositories()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnInit(): void {}

	/**
	 * Pre-selects a repository based on the provided source ID.
	 *
	 * @param sourceId - The ID of the source repository to pre-select.
	 */
	private _preSelectedRepository(sourceId: IGithubRepository['id']) {
		// Find the repository in the list of repositories using the source ID
		const repository = this.repositories.find((repository: IGithubRepository) => repository.id === sourceId);

		// If the repository is found, select it
		if (repository) {
			this.selectRepository(repository);
		}
	}

	/**
	 * Fetches repositories for a given integration and organization.
	 */
	private _getRepositories() {
		// Ensure there is a valid organization
		if (!this.organization) {
			return;
		}

		this.loading = true;

		// Extract organization properties
		const { id: organizationId, tenantId } = this.organization;
		const { id: integrationId } = this.integration;

		const repositories$ = this._githubService.getRepositories(integrationId, {
			organizationId,
			tenantId
		});
		this.repositories$ = repositories$.pipe(
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
			untilDestroyed(this)
		);
	}

	/**
	 * Selects a GitHub repository and retrieves its associated issues.
	 * @param repository - The GitHub repository to select.
	 */
	public selectRepository(repository: IGithubRepository) {
		if (repository) {
			this.onChanged.emit(repository);
		}
	}

	// Define the writeValue method required for ControlValueAccessor
	public writeValue(value: IGithubRepository['id']) {
		this._sourceId = value;
	}

	// Define the registerOnChange method required for ControlValueAccessor
	public registerOnChange(fn: (value: IGithubRepository['id']) => void) {
		this.onChange = fn;
	}

	// Define the registerOnTouched method required for ControlValueAccessor
	public registerOnTouched(fn: () => void) {
		this.onTouched = fn;
	}

	ngOnDestroy(): void {}
}
