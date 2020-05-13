import { Component, OnInit } from '@angular/core';
import { Task, OrganizationProjects, Employee } from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import * as moment from 'moment';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { first } from 'rxjs/operators';

const initialTaskValue = {
	title: '',
	project: null,
	status: '',
	members: null,
	estimate: null,
	dueDate: null,
	description: '',
	tags: null
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
	employees: Employee[] = [];
	selectedMembers: string[];
	selectedTask: Task;
	organizationId: string;
	selectedTags: any;

	constructor(
		public dialogRef: NbDialogRef<TaskDialogComponent>,
		private fb: FormBuilder,
		private store: Store,
		private _organizationsStore: Store,
		private organizationProjectsService: OrganizationProjectsService,
		readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private errorHandler: ErrorHandlingService,
		private employeesService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadProjects();
		this.loadEmployees();
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

	initializeForm({
		title,
		description,
		project,
		status,
		members,
		estimate,
		dueDate,
		tags
	}: Task) {
		const duration = moment.duration(estimate, 'seconds');
		this.selectedMembers = (members || []).map((member) => member.id);
		this.form = this.fb.group({
			title: [title, Validators.required],
			project: [project],
			status: [status],
			members: [members],
			estimateDays: [duration.days() || ''],
			estimateHours: [
				duration.hours() || '',
				[Validators.min(0), Validators.max(23)]
			],
			estimateMinutes: [
				duration.minutes() || '',
				[Validators.min(0), Validators.max(59)]
			],
			dueDate: [dueDate],
			description: [description],
			tags: []
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
			this.form
				.get('members')
				.setValue(
					(this.selectedMembers || [])
						.map((id) => this.employees.find((e) => e.id === id))
						.filter((e) => !!e)
				);
			this.dialogRef.close(this.form.value);
		}
	}

	selectedTagsHandler(ev) {
		// we dont need this, at least we dont need for create or update TASK
		// this.tags = ev;
	}

	private async loadEmployees() {
		const organizationId = this._organizationsStore.selectedOrganization.id;
		if (!organizationId) {
			return;
		}

		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: organizationId } })
			.pipe(first())
			.toPromise();

		this.employees = items;
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}
}
