import { Component, OnInit } from '@angular/core';
import { Task, OrganizationProjects, Tag } from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

const initialTaskValue = {
	title: '',
	project: null,
	status: '',
	description: ''
};

@Component({
	selector: 'ngx-task-dialog',
	templateUrl: './task-dialog.component.html',
	styleUrls: ['./task-dialog.component.scss']
})
export class TaskDialogComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	selectedTaskId: string;
	projects: OrganizationProjects[];
	statuses: string[] = ['Todo', 'In Progress', 'For Testing', 'Completed'];
	selectedTask: Task;
	organizationId: string;
	tags: Tag[];
	selectedTags: any;

	constructor(
		public dialogRef: NbDialogRef<TaskDialogComponent>,
		private fb: FormBuilder,
		private store: Store,
		private _organizationsStore: Store,
		private organizationProjectsService: OrganizationProjectsService,
		readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadProjects();
		this.initializeForm(this.selectedTask || initialTaskValue);
	}

	private async loadProjects() {
		const organizationId = this._organizationsStore.selectedOrganization.id;
		const { items } = await this.organizationProjectsService.getAll(
			['client'],
			{
				organizationId
			}
		);

		if (items) this.projects = items;
	}

	initializeForm({ title, description, project, status }: Task) {
		this.form = this.fb.group({
			title: [title, Validators.required],
			project: [project],
			status: [status],
			description: [description],
			tags: [this.tags]
		});
	}

	addNewProject = (name: string): Promise<OrganizationProjects> => {
		this.organizationId = this.store.selectedOrganization.id;
		try {
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			return this.organizationProjectsService.create({
				name,
				organizationId: this.organizationId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	onSave() {
		if (this.form.valid) {
			this.dialogRef.close(this.form.value);
		}
	}

	selectedTagsHandler(ev) {
		this.tags = ev;
	}
}
