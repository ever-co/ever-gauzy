import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { IOrganization, IOrganizationProject, IOrganizationProjectCreateInput } from '@gauzy/contracts';
import { ProjectMutationComponent } from './../../../../@shared/project';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { ErrorHandlingService, OrganizationProjectsService, Store, ToastrService } from './../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-project-create-mutation',
	templateUrl: './create.component.html',
	styleUrls: ['./create.component.scss']
})
export class ProjectCreateMutationComponent extends TranslationBaseComponent implements OnInit {
	/** Project Mutation Component*/
	@ViewChild(ProjectMutationComponent, { static: false }) public _component: ProjectMutationComponent;

	public loading: boolean;
	public organization: IOrganization = this._store.selectedOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _store: Store,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {}

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
			const input: IOrganizationProjectCreateInput = {
				...value,
				organizationId,
				tenantId
			};
			const project: IOrganizationProject = await this._organizationProjectsService.create(input);

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
