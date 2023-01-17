import { Component, Input, OnInit } from '@angular/core';
import {
	ITask,
	IOrganizationProject,
	IEmployee,
	IOrganizationTeam,
	ITag,
	TaskStatusEnum,
} from '@gauzy/contracts';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import {
	ErrorHandlingService,
	OrganizationProjectsService,
	OrganizationTeamsService,
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
	selector: 'ngx-team-task-dialog',
	templateUrl: './team-task-dialog.component.html',
	styleUrls: ['./team-task-dialog.component.scss'],
})
export class TeamTaskDialogComponent
	extends TranslationBaseComponent
	implements OnInit
{
	form: FormGroup;
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
	@Input() task: Partial<ITask> = {};

	constructor(
		public readonly dialogRef: NbDialogRef<TeamTaskDialogComponent>,
		private readonly fb: FormBuilder,
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

	ngOnInit() {
		this.tenantId = this.store.user.tenantId;
		this.organizationId = this._organizationsStore.selectedOrganization.id;

		this.loadProjects();
		this.loadTeams();
		this.initializeForm(
			Object.assign({}, initialTaskValue, this.selectedTask || this.task)
		);
	}

	private async loadProjects() {
		const { organizationId, tenantId } = this;
		const { items } = await this.organizationProjectsService.getAll([], {
			organizationId,
			tenantId,
		});

		if (items) this.projects = items;
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
			teams: [this.selectedTeams],
		});

		this.tags = this.form.get('tags').value || [];
	}

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		const { organizationId, tenantId } = this;
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				{ name }
			);
			return this.organizationProjectsService.create({
				name,
				organizationId,
				tenantId,
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
					(this.selectedTeams || [])
						.map((id) => this.teams.find((e) => e.id === id))
						.filter((e) => !!e)
				);
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
				tenantId,
			})
		).items;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}
}
