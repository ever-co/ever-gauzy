import { Component, OnInit, Input } from '@angular/core';
import {
	ITask,
	IOrganizationProject,
	IEmployee,
	IOrganizationTeam,
	ITag
} from '@gauzy/contracts';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { Store } from '../../../@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import * as moment from 'moment';
import { EmployeesService } from '../../../@core/services';
import { first } from 'rxjs/operators';
import { OrganizationTeamsService } from '../../../@core/services/organization-teams.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ToastrService } from '../../../@core/services/toastr.service';

@Component({
	selector: 'ngx-add-task-dialog',
	templateUrl: './add-task-dialog.component.html',
	styleUrls: ['./add-task-dialog.component.scss']
})
export class AddTaskDialogComponent
	extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	selectedTaskId: string;
	projects: IOrganizationProject[];
	statuses: string[] = [
		this.getTranslation('TASKS_PAGE.TODO'),
		this.getTranslation('TASKS_PAGE.IN_PROGRESS'),
		this.getTranslation('TASKS_PAGE.FOR_TESTING'),
		this.getTranslation('TASKS_PAGE.COMPLETED')
	];
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedMembers: string[];
	selectedTeams: string[];
	selectedTask: ITask;
	organizationId: string;
	tenantId: string;
	tags: ITag[] = [];
	participants = 'employees';
	initialTaskValue = {
		title: '',
		project: null,
		status: this.getTranslation('TASKS_PAGE.TODO'),
		members: null,
		teams: null,
		estimate: null,
		dueDate: null,
		description: '',
		tags: null
	};

	@Input() createTask = false;
	@Input() task: Partial<ITask> = {};

	constructor(
		public dialogRef: NbDialogRef<AddTaskDialogComponent>,
		private fb: FormBuilder,
		private store: Store,
		private organizationProjectsService: OrganizationProjectsService,
		readonly translateService: TranslateService,
		private readonly toastrService: ToastrService,
		private errorHandler: ErrorHandlingService,
		private employeesService: EmployeesService,
		private tasksService: TasksService,
		private organizationTeamsService: OrganizationTeamsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.organizationId = this.store.selectedOrganization.id;
		this.tenantId = this.store.user.tenantId;

		this.loadProjects();
		this.loadEmployees();
		this.loadTeams();

		this.initializeForm(
			Object.assign(
				{},
				this.initialTaskValue,
				this.selectedTask || this.task
			)
		);
	}

	private async loadProjects() {
		const { items } = await this.organizationProjectsService.getAll(
			['organization'],
			{ organizationId: this.organizationId, tenantId: this.tenantId }
		);
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
		tags
	}: ITask) {
		const duration = moment.duration(estimate, 'seconds');
		this.selectedMembers = (members || []).map((member) => member.id);
		this.selectedTeams = (teams || []).map((team) => team.id);
		if (teams && teams.length > 0) {
			this.participants = 'teams';
		}
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
			tags: [tags],
			teams: [this.selectedTeams],
			organizationId: [this.organizationId],
			tenantId: [this.tenantId]
		});

		this.tags = this.form.get('tags').value || [];
	}

	addNewProject = (name: string): Promise<IOrganizationProject> => {
		this.organizationId = this.store.selectedOrganization.id;
		this.tenantId = this.store.user.tenantId;
		try {
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				{
					name: name
				}
			);
			return this.organizationProjectsService.create({
				name,
				organizationId: this.organizationId,
				tenantId: this.tenantId
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
			this.form
				.get('teams')
				.setValue(
					(this.selectedTeams || [])
						.map((id) => this.teams.find((e) => e.id === id))
						.filter((e) => !!e)
				);

			if (this.form.valid) {
				const {
					estimateDays,
					estimateHours,
					estimateMinutes
				} = this.form.value;

				const estimate =
					estimateDays * 24 * 60 * 60 +
					estimateHours * 60 * 60 +
					estimateMinutes * 60;

				estimate
					? (this.form.value.estimate = estimate)
					: (this.form.value.estimate = null);
				if (this.createTask) {
					this.tasksService
						.createTask(this.form.value)
						.toPromise()
						.then((task) => {
							this.dialogRef.close(task);
						});
				}
			}
			if (!this.createTask) {
				this.dialogRef.close(this.form.value);
			}
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
	}

	private async loadEmployees() {
		if (!this.organizationId) {
			return;
		}
		const { items } = await this.employeesService
			.getAll(['user'], {
				organizationId: this.organizationId,
				tenantId: this.tenantId
			})
			.pipe(first())
			.toPromise();

		if (items) this.employees = items;
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}

	async loadTeams() {
		if (!this.organizationId) {
			return;
		}
		const { items } = await this.organizationTeamsService.getAll(
			['members'],
			{ organizationId: this.organizationId, tenantId: this.tenantId }
		);
		if (items) this.teams = items;
	}

	onParticipantsChange(participants: string) {
		this.selectedMembers = [];
		this.selectedTeams = [];
		this.form.get('members').setValue([]);
		this.form.get('teams').setValue([]);
		this.participants = participants;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}
}
