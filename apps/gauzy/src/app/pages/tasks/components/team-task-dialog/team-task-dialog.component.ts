import { Component, Input, OnInit } from '@angular/core';
import { IEmployee, IOrganizationProject, IOrganizationTeam, ITag, ITask, TaskStatusEnum } from '@gauzy/contracts';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import moment from 'moment';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { richTextCKEditorConfig } from '@gauzy/ui-core/shared';
import {
	ErrorHandlingService,
	OrganizationProjectsService,
	OrganizationTeamsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';

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
	taskStatus: null,
	taskSize: null,
	taskPriority: null
};

@Component({
	selector: 'ngx-team-task-dialog',
	templateUrl: './team-task-dialog.component.html',
	styleUrls: ['./team-task-dialog.component.scss']
})
export class TeamTaskDialogComponent extends TranslationBaseComponent implements OnInit {
	selectedTaskId: string;
	projects: IOrganizationProject[];
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedMembers: string[];
	selectedTeams: string[];
	selectedTask: ITask;
	organizationId: string;
	tenantId: string;
	tags: ITag[] = [];
	public ckConfig: CKEditor4.Config = richTextCKEditorConfig;
	@Input() task: Partial<ITask> = {};

	public form: UntypedFormGroup = TeamTaskDialogComponent.buildForm(this.fb);

	constructor(
		public readonly dialogRef: NbDialogRef<TeamTaskDialogComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly _organizationsStore: Store,
		private readonly organizationProjectsService: OrganizationProjectsService,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly organizationTeamsService: OrganizationTeamsService
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
		const { organizationId, tenantId } = this;
		const { items } = await this.organizationProjectsService.getAll([], {
			organizationId,
			tenantId
		});

		if (items) this.projects = items;
	}

	async ngOnInit() {
		this.ckConfig.editorplaceholder = this.translateService.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		this.tenantId = this.store.user.tenantId;
		this.organizationId = this._organizationsStore.selectedOrganization.id;

		await this.loadProjects();
		await this.loadTeams();
		this.initializeForm(Object.assign({}, initialTaskValue, this.selectedTask || this.task));
	}

	initializeForm({
		title,
		description,
		project,
		status,
		members,
		teams,
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
		this.selectedTeams = (teams || []).map((team) => team.id);
		// employee id of logged in user, if value is null, disable the save button
		// this.teamIds = null;
		// if (this.store.user) {
		// 	this.teamIds = this.store.user || null;
		// }
		// // select default id of logged in user
		// if (teams === null) {
		// 	this.selectedTeams = [this.employeeId];
		// }
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
			members,
			description,
			tags,
			teams: this.selectedTeams,
			taskStatus,
			taskSize,
			taskPriority
		});
		this.tags = this.form.get('tags').value || [];
	}

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		const { organizationId, tenantId } = this;
		try {
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', { name });
			return this.organizationProjectsService.create({
				name,
				organizationId,
				tenantId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	onSave() {
		if (this.form.valid) {
			this.form
				.get('teams')
				.setValue(
					(this.selectedTeams || []).map((id) => this.teams.find((e) => e.id === id)).filter((e) => !!e)
				);
			this.form.get('status').setValue(this.form.get('taskStatus').value?.name);
			this.form.get('priority').setValue(this.form.get('taskPriority').value?.name);
			this.form.get('size').setValue(this.form.get('taskSize').value?.name);
			this.dialogRef.close(this.form.value);
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	selectedProject(project: IOrganizationProject) {
		this.form.patchValue({ project });
	}

	async loadTeams() {
		const { organizationId, tenantId } = this;
		if (!organizationId) {
			return;
		}
		this.teams = (
			await this.organizationTeamsService.getMyTeams({
				organizationId,
				tenantId
			})
		).items;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}
}
