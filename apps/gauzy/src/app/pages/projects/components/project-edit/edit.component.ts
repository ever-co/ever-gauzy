import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, map, tap, Observable } from 'rxjs';
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
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Call the following methods to initialize component properties
		this._getEditProject();
		this._getGithubIntegrationTenant();
	}

	/**
	 * Fetches and sets the project data from the route's data property.
	 */
	private _getEditProject() {
		this.project$ = this._activatedRoute.data.pipe(
			filter((data: Data) => !!data && !!data.project),
			map(({ project }) => project),
			tap((project) => {
				this.project = project;
				this._cdr.detectChanges(); // Trigger change detection to avoid ExpressionChangedAfterItHasBeenCheckedError
			}),
			untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
		);
	}
	/**
	 * Fetches and sets the GitHub integration data from the route's data property.
	 */
	private _getGithubIntegrationTenant() {
		this.integration$ = this._activatedRoute.data.pipe(
			map(({ integration }) => integration),
			untilDestroyed(this) // Automatically unsubscribes when the component is destroyed
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

	/**
	 * Handle favorite toggle event
	 */
	onFavoriteToggled(_event: { isFavorite: boolean; favorite?: IFavorite }): void {
		// The FavoriteToggleComponent already shows success/error messages
		// Additional logic can be added here if needed (analytics, state updates, etc.)
	}
}
