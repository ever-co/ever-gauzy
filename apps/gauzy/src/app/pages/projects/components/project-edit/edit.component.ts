import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { catchError, debounceTime, delay, of, switchMap } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	IIntegrationMap,
	IIntegrationTenant,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectUpdateInput,
	IntegrationEntity
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ProjectMutationComponent } from './../../../../@shared/project';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import {
	ErrorHandlingService,
	IntegrationMapService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-project-edit-mutation',
	templateUrl: './edit.component.html',
	styleUrls: ['./edit.component.scss']
})
export class ProjectEditMutationComponent extends TranslationBaseComponent implements OnInit {

	/** Project Mutation Component*/
	@ViewChild(ProjectMutationComponent, { static: false }) public _component: ProjectMutationComponent;

	public loading: boolean;
	public integrationMap$: Observable<IIntegrationMap | boolean>;
	public integration$: Observable<IIntegrationTenant>;
	public project$: Observable<IOrganizationProject>;
	public project: IOrganizationProject;
	public organization: IOrganization = this._store.selectedOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _store: Store,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _integrationMapService: IntegrationMapService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Call the following methods to initialize component properties
		this.getEditProject();
		this.getGithubIntegrationTenant();
		this.getSyncedGithubRepository();
	}

	/**
	 * Fetches and sets the project data from the route's data property.
	 */
	getEditProject() {
		this.project$ = this._activatedRoute.data.pipe(
			filter((data: Data) => !!data && !!data.project),
			map(({ project }) => {
				this.project = project; // Assuming 'project' is a component property
				return project;
			}),
			untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
		);
	}

	/**
	 * Fetches and sets the GitHub integration data from the route's data property.
	 */
	getGithubIntegrationTenant() {
		this.integration$ = this._activatedRoute.data.pipe(
			map(({ integration }) => integration),
			untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
		);
	}

	/**
	 * Fetches and handles synchronized GitHub repository data.
	 * This method is not provided in your code but is expected to be present.
	 */
	getSyncedGithubRepository() {
		this.integrationMap$ = this._store.selectedOrganization$.pipe(
			debounceTime(100),
			distinctUntilChange(),
			switchMap((organization: IOrganization) => {
				// Ensure there is a valid organization
				if (!organization) {
					return of(false); // No valid organization, return false
				}

				// Extract organization properties
				const { id: organizationId, tenantId } = this.organization;

				return this._activatedRoute.data.pipe(
					delay(1000), // Delay for loading effect
					filter(({ integration, project }) => !!integration && !!project),
					// Get the 'integration' and 'project' route parameter
					switchMap(({ integration, project }) => this._integrationMapService.getSyncedGithubRepository({
						organizationId,
						tenantId,
						integrationId: integration.id,
						gauzyId: project.id,
						entity: IntegrationEntity.PROJECT
					})),
					catchError((error) => {
						// Handle and log errors
						this._errorHandlingService.handleError(error); // Handle and log errors
						return of(false);
					}),
					// Handle component lifecycle to avoid memory leaks
					untilDestroyed(this),
				);
			})
		);
	}

	/**
	 * Handles the submission of the project mutation form.
	 *
	 * @param form The FormGroup containing project data.
	 */
	async onSubmit(value: IOrganizationProject) {
		if (this._component.form.invalid || !this.organization) {
			return;
		}
		/** Make loading true  */
		this.loading = true;
		try {

			const { id: organizationId, tenantId } = this.organization;
			const { id } = this.project;

			const input: IOrganizationProjectUpdateInput = {
				...value,
				organizationId,
				tenantId,
				id
			};
			/** Organization Project Update Request */
			const project: IOrganizationProject = await this._organizationProjectsService.edit(input);

			this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', {
				name: project.name
			});

			this.navigateToProjects();
		} catch (error) {
			console.log('Error while creating organization project', error?.message);
			this._errorHandlingService.handleError(error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Navigates to the projects page.
	 */
	navigateToProjects() {
		this._router.navigate(['/pages/organization/projects']);
	}
}
