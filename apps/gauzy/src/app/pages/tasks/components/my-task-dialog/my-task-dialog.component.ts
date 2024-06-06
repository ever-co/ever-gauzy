import { Component, Input, OnInit } from '@angular/core';
import { IEmployee, IOrganizationProject, ITag, ITask, TaskStatusEnum } from '@gauzy/contracts';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { firstValueFrom } from 'rxjs';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { richTextCKEditorConfig } from '@gauzy/ui-sdk/shared';
import { EmployeesService, ErrorHandlingService, OrganizationProjectsService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';

const initialTaskValue = {
	title: '',
	project: null,
	status: '',
	members: null,
	teams: null,
	estimate: null,
	dueDate: null,
	description: '',
	tags: null
};

@Component({
	selector: 'ngx-my-task-dialog',
	templateUrl: './my-task-dialog.component.html',
	styleUrls: ['./my-task-dialog.component.scss']
})
export class MyTaskDialogComponent extends TranslationBaseComponent implements OnInit {
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
	public ckConfig: CKEditor4.Config = richTextCKEditorConfig;
	public form: UntypedFormGroup = MyTaskDialogComponent.buildForm(this.fb);

	constructor(
		public readonly dialogRef: NbDialogRef<MyTaskDialogComponent>,
		private readonly fb: UntypedFormBuilder,
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

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			number: [{ value: '', disabled: true }],
			title: [null, Validators.required],
			project: [],
			projectId: [],
			status: [TaskStatusEnum.OPEN],
			priority: [],
			size: [],
			members: [],
			estimateDays: [],
			estimateHours: [null, [Validators.min(0), Validators.max(23)]],
			estimateMinutes: [null, [Validators.min(0), Validators.max(59)]],
			dueDate: [],
			description: [],
			tags: [],
			teams: [],
			taskStatus: [],
			taskSize: [],
			taskPriority: []
		});
	}

	private async loadProjects() {
		const organizationId = this._organizationsStore.selectedOrganization.id;
		const { items } = await this.organizationProjectsService.getAll(
			//['client']
			[],
			{
				organizationId: organizationId
			}
		);

		if (items) this.projects = items;
	}

	private async loadEmployees() {
		const organizationId = this._organizationsStore.selectedOrganization.id;
		if (!organizationId) {
			return;
		}

		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organization: { id: organizationId }
			})
		);

		this.employees = items;
	}

	async ngOnInit() {
		this.ckConfig.editorplaceholder = this.translateService.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		await this.loadProjects();
		await this.loadEmployees();
		this.initializeForm(Object.assign({}, initialTaskValue, this.selectedTask || this.task));
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
		priority,
		size,
		taskStatus,
		taskSize,
		taskPriority
	}: ITask) {
		const duration = moment.duration(estimate, 'seconds');
		// select members from database of default value
		this.selectedMembers = (members || []).map((member) => member.id);
		// employee id of logged in user, if value is null, disable the save button
		this.employeeId = null;

		if (this.store.user) {
			this.employeeId = this.store.user?.employee?.id || null;
		}
		// select default id of logged in user
		if (members === null) {
			this.selectedMembers = [this.employeeId];
		}
		this.form.patchValue({
			title,
			project,
			projectId: project ? project.id : null,
			status,
			priority,
			size,
			estimateDays: duration.days(),
			estimateHours: duration.hours(),
			estimateMinutes: duration.minutes(),
			dueDate: dueDate ? new Date(dueDate) : null,
			description,
			tags,
			members: [this.selectedMembers],
			taskStatus,
			taskSize,
			taskPriority,
			teams: []
		});
		this.tags = this.form.get('tags').value || [];
	}

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		this.organizationId = this.store.selectedOrganization.id;
		try {
			this.toastrService.success(
				this.getTranslation('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT'),
				{ name: name }
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
			this.form.get('status').setValue(this.form.get('taskStatus').value?.name);
			this.form.get('priority').setValue(this.form.get('taskPriority').value?.name);
			this.form.get('size').setValue(this.form.get('taskSize').value?.name);
			this.form
				.get('members')
				.setValue(
					(this.selectedMembers || []).map((id) => this.employees.find((e) => e.id === id)).filter((e) => !!e)
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
}
