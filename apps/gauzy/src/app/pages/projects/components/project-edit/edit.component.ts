import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, filter, Observable } from 'rxjs';
import {
	IFavorite,
	IIntegrationTenant,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectUpdateInput
} from '@gauzy/contracts';
import { ErrorHandlingService, OrganizationProjectsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ProjectMutationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-project-edit-mutation',
	templateUrl: './edit.component.html',
	styleUrls: ['./edit.component.scss'],
	standalone: false
})
export class ProjectEditMutationComponent extends TranslationBaseComponent implements OnInit {
	/** Project Mutation Component*/
	@ViewChild(ProjectMutationComponent, { static: false }) public _component: ProjectMutationComponent;

	public loading: boolean;
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
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Watch for both route data changes and parameter changes to handle navigation between different projects
		this._watchRouteChanges();
	}

	/**
	 * Watches for route changes (both data and parameters) to handle navigation between different projects
	 */
	private _watchRouteChanges() {
		// Watch for both route data and parameter changes
		combineLatest([this._activatedRoute.data, this._activatedRoute.params])
			.pipe(
				filter(([data, params]) => !!data && !!data.project && !!params && !!params.id),
				untilDestroyed(this)
			)
			.subscribe(([data, params]) => {
				// Clear previous project data when navigating to a different project
				if (this.project && this.project.id !== params.id) {
					this.project = null;
				}

				// Load the new project data
				this._getEditProject(data);
				this._getGithubIntegrationTenant(data);
			});
	}

	/**
	 * Fetches and sets the project data from the route's data property.
	 */
	private _getEditProject(data?: Data) {
		const routeData = data || this._activatedRoute.snapshot.data;

		if (routeData && routeData.project) {
			this.project = routeData.project;
		}
	}

	/**
	 * Fetches and sets the GitHub integration data from the route's data property.
	 */
	private _getGithubIntegrationTenant(data?: Data) {
		const routeData = data || this._activatedRoute.snapshot.data;
		this.integration$ = new Observable((observer) => {
			if (routeData && routeData.integration) {
				observer.next(routeData.integration);
				observer.complete();
			} else {
				observer.next(null);
				observer.complete();
			}
		});
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

	/**
	 * Handle favorite toggle event
	 */
	onFavoriteToggled(_event: { isFavorite: boolean; favorite?: IFavorite }): void {
		// The FavoriteToggleComponent already shows success/error messages
		// We can add any additional logic here if needed, such as:
		// - Updating local state
		// - Triggering analytics events
		// - Refreshing related data
	}
}
