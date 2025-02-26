import { Component, OnInit, forwardRef, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IGithubRepository, IGithubRepositoryResponse, IIntegrationTenant, IOrganization } from '@gauzy/contracts';
import { ErrorHandlingService, GithubService, Store } from '@gauzy/ui-core/core';

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
    ],
    standalone: false
})
export class RepositorySelectorComponent implements OnInit, OnDestroy {
	public preSelected: boolean = false;
	public loading: boolean = false;
	private subject$: Subject<IIntegrationTenant> = new Subject<IIntegrationTenant>();
	public organization: IOrganization = this._store.selectedOrganization;
	public repositories: IGithubRepository[] = [];
	public repositories$: Observable<IGithubRepository[]>;

	/**
	 * Placeholder text to guide the user. Defaults to null if not provided.
	 */
	@Input() placeholder: string | null = null;

	/**
	 * Indicates whether the component is selected. Defaults to false.
	 */
	@Input() selected: boolean = false;

	/** Getter & Setter for integration */
	private _integration: IIntegrationTenant;
	/**
	 * Setter for the integration property.
	 * Updates the integration and notifies observers with the new value.
	 */
	@Input() set integration(value: IIntegrationTenant) {
		if (value) {
			this._integration = value;
			this.subject$.next(value); // Emit the updated value to observers
		}
	}
	/**
	 * Getter for the integration property.
	 * Returns the current integration value.
	 */
	get integration(): IIntegrationTenant {
		return this._integration;
	}

	// Define the getter and setter for the repository
	private _sourceId: number;
	/**
	 * Setter for the sourceId property.
	 * Updates the source ID and triggers relevant changes when a valid value is provided.
	 */
	@Input() set sourceId(val: number) {
		if (val) {
			// Check if the conversion was successful
			this._sourceId = val;

			this.onChange(this._sourceId); // Trigger the onChange event with the converted number
			this.onTouched(); // Mark the field as touched

			// Handle pre-selected repository if applicable
			if (this.selected) {
				this._preSelectedRepository(this._sourceId); // Pre-select the repository
			}
		}
	}
	/**
	 * Getter for the sourceId property.
	 * Returns the current source ID value.
	 */
	get sourceId(): number {
		return this._sourceId;
	}

	/** */
	@Output() onChanged = new EventEmitter<IGithubRepository>();
	@Output() afterLoad = new EventEmitter<IGithubRepository[]>();

	// Implement your onChange and onTouched methods
	onChange: (value: number) => void = () => {};
	onTouched: () => void = () => {};

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
	private _preSelectedRepository(sourceId: number): void {
		const repository = this.repositories.find((repo: IGithubRepository) => repo.id === sourceId);

		if (repository) {
			this.selectRepository(repository); // Select the found repository
		}
	}

	/**
	 * Fetches repositories for a given integration and organization.
	 */
	private _getRepositories() {
		if (!this.integration) return; // Ensure a valid integration is present

		this.loading = true;

		// Destructure required properties from the integration object
		const { id: integrationId, organizationId, tenantId } = this.integration;

		// Fetch the repositories using the integration details
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
				// Set loading to false once finished
				this.loading = false;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Selects a GitHub repository and emits the selection event.
	 *
	 * @param repository - The selected GitHub repository.
	 */
	public selectRepository(repository: IGithubRepository) {
		if (repository) {
			this.onChanged.emit(repository); // Emit the selected repository
		}
	}

	/**
	 * Write the value (repository ID) into the component.
	 *
	 * @param value - The value to be written, representing the repository ID.
	 */
	public writeValue(value: number): void {
		this._sourceId = value; // Assign the provided value to _sourceId
	}

	/**
	 * Register a function to call when the control's value changes.
	 *
	 * @param fn - The function that handles value changes.
	 */
	public registerOnChange(fn: (value: number) => void): void {
		this.onChange = fn;
	}

	/**
	 * Register a function to call when the control is touched.
	 *
	 * @param fn - The function that handles touch events.
	 */
	public registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	ngOnDestroy(): void {}
}
