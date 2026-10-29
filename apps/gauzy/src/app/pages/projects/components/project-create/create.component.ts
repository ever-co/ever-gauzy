import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { BaseEntityEnum, IOrganization, IOrganizationProject, IOrganizationProjectCreateInput } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ErrorHandlingService, OrganizationProjectsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { ProjectMutationComponent } from '@gauzy/ui-core/shared';
import { DocumentLinksPanelComponent } from '@gauzy/plugin-docs-ui';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-project-create-mutation',
    templateUrl: './create.component.html',
    styleUrls: ['./create.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProjectCreateMutationComponent extends TranslationBaseComponent implements OnInit {
	/** Project Mutation Component*/
	@ViewChild(ProjectMutationComponent, { static: false }) public _component: ProjectMutationComponent;
	/** The Documents panel holding the files to attach once the project is saved. */
	@ViewChild(DocumentLinksPanelComponent, { static: false }) private _documentsPanel: DocumentLinksPanelComponent;

	public loading: boolean;
	public organization: IOrganization = this._store.selectedOrganization;
	/** The project a first save created, kept while its files still have to be attached. */
	private _createdProject: IOrganizationProject | null = null;

	/** Entity type the record-side Documents panel attaches its links to. */
	public readonly documentEntity = BaseEntityEnum.OrganizationProject;

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

			// A save whose files did not all attach left the project created: saving again only retries the files.
			if (!this._createdProject) {
				const { id: organizationId, tenantId } = this.organization;
				const input: IOrganizationProjectCreateInput = {
					...value,
					organizationId,
					tenantId
				};
				this._createdProject = await this._organizationProjectsService.create(input);

				this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', {
					name: this._createdProject.name
				});
			}
			const project = this._createdProject;

			// The project exists now: attach the files picked while it was being filled in. A file that
			// failed stays listed in the panel, which has already said why, and the page stays for a retry.
			const attached = this._documentsPanel ? await this._documentsPanel.attachPending(project.id, project.name) : true;
			if (!attached) return;

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
