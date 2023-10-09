import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Data, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	IIntegrationTenant,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectUpdateInput
} from '@gauzy/contracts';
import { ProjectMutationComponent } from './../../../../@shared/project';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import {
	ErrorHandlingService,
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
		this.project$ = this._activatedRoute.data.pipe(
			filter((data: Data) => !!data && !!data.project),
			map(({ project }) => {
				this.project = project;
				return project;
			}),
			untilDestroyed(this)
		);
		this.integration$ = this._activatedRoute.data.pipe(
			map(({ integration }) => integration),
			untilDestroyed(this)
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
		try {
			this.loading = true;

			const { id: organizationId, tenantId } = this.organization;
			const { id } = this.project;

			const input: IOrganizationProjectUpdateInput = {
				...value,
				organizationId,
				tenantId,
				id
			};
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
