import { Component, OnInit } from '@angular/core';
import { Task, OrganizationProjects } from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

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
export class TaskDialogComponent implements OnInit {
	form: FormGroup;
	selectedTaskId: string;
	projects: OrganizationProjects[];
	statuses: string[] = ['Todo', 'In Progress', 'For Testing', 'Completed'];
	selectedTask: Task;

	constructor(
		public dialogRef: NbDialogRef<TaskDialogComponent>,
		private fb: FormBuilder,
		private _organizationsStore: Store,
		private organizationProjectsService: OrganizationProjectsService
	) {}

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
			description: [description]
		});
	}

	onSave() {
		if (this.form.valid) {
			this.dialogRef.close(this.form.value);
		}
	}
}
