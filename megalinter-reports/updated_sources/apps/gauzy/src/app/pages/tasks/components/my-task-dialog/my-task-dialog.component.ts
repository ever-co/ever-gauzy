import { Component, Input, OnInit } from '@angular/core';
import {
	ITask,
	IOrganizationProject,
	IEmployee,
	ITag,
	TaskStatusEnum,
} from '@gauzy/contracts';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { firstValueFrom } from 'rxjs';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import {
	EmployeesService,
	ErrorHandlingService,
	OrganizationProjectsService,
	Store,
	ToastrService,
} from '../../../../@core/services';

const initialTaskValue = {
	title: '',
	project: null,
	status: '',
	members: null,
	teams: null,
	estimate: null,
	dueDate: null,
	description: '',
	tags: null,
};

@Component({
	selector: 'ngx-my-task-dialog',
	templateUrl: './my-task-dialog.component.html',
	styleUrls: ['./my-task-dialog.component.scss'],
})
export class MyTaskDialogComponent
	extends TranslationBaseComponent
	implements OnInit
{
	form: FormGroup;
	selectedTaskId: string;
	projects: IOrganizationProject[];
	employees: IEmployee[] = [];
	selectedMembers: string[];
	selectedTask: ITask;
	organizationId: string;
	selectedTags: any;
	participants = 'employees';
	employeeId;
	tags: ITag[] = [];
	@Input() task: Partial<ITask> = {};

	constructor(
		public readonly dialogRef: NbDialogRef<MyTaskDialogComponent>,
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly _organizationsStore: Store,
		private readonly organizationProjectsService: OrganizationProjectsService,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly employeesService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadProjects();
		this.loadEmployees();
		this.initializeForm(
			Object.assign({}, initialTaskValue, this.selectedTask || this.task)
		);
	}

	private async loadProjects() {
		const organizationId = this._organizationsStore.selectedOrganization.id;
		const { items } = await this.organizationProjectsService.getAll(
			//['client']
			[],
			{
				organizationId: organizationId,
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
		tags,
	}: ITask) {
		const duration = moment.duration(estimate, 'seconds');
		// select members from database of default value
		this.selectedMembers = (members || []).map((member) => member.id);
		// employee id of logged in user, if value is null, disable the save button
		this.employeeId = null;
		if (this.store.user) {
			this.employeeId = this.store.user.employeeId || null;
		}
		// select default id of logged in user
		if (members === null) {
			this.selectedMembers = [this.employeeId];
		}
		this.form = this.fb.group({
			number: [{ value: '', disabled: true }],
			title: [title, Validators.required],
			project: [project],
			projectId: project ? project.id : null,
			status: [status ? status : TaskStatusEnum.OPEN],
			members: [members],
			estimateDays: [duration.days() || ''],
			estimateHours: [
				duration.hours() || '',
				[Validators.min(0), Validators.max(23)],
			],
			estimateMinutes: [
				duration.minutes() || '',
				[Validators.min(0), Validators.max(59)],
			],
			dueDate: [dueDate],
			description: [description],
			tags: [tags],
			teams: [],
		});
		this.tags = this.form.get('tags').value || [];
	}

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		this.organizationId = this.store.selectedOrganization.id;
		try {
			this.toastrService.success(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT'
				),
				{ name: name }
			);
			return this.organizationProjectsService.create({
				name,
				organizationId: this.organizationId,
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

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.patchValue({ tags: currentSelection });
	}

	selectedProject(project: IOrganizationProject) {
		this.form.patchValue({ project });
	}

	private async loadEmployees() {
		const organizationId = this._organizationsStore.selectedOrganization.id;
		if (!organizationId) {
			return;
		}

		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organization: { id: organizationId },
			})
		);

		this.employees = items;
	}
}
