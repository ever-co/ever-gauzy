import { Component, OnInit, Input } from '@angular/core';
import {
	ITask,
	IOrganizationProject,
	IEmployee,
	IOrganizationTeam,
	ITag,
	TaskParticipantEnum,
	IOrganization
} from '@gauzy/contracts';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { filter, first, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { EmployeesService, OrganizationTeamsService, Store, TasksService } from '../../../@core/services';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-add-task-dialog',
	templateUrl: './add-task-dialog.component.html',
	styleUrls: ['./add-task-dialog.component.scss']
})
export class AddTaskDialogComponent
	extends TranslationBaseComponent
	implements OnInit {
		
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedMembers: string[];
	selectedTeams: string[];
	selectedTask: ITask;
	organization: IOrganization;
	taskParticipantEnum = TaskParticipantEnum;
	participants = TaskParticipantEnum.EMPLOYEES;
	
	@Input() createTask = false;

	/*
	* Getter & Setter for task
	*/
	_task: ITask;
	get task(): ITask {
		return this._task;
	}
	@Input() set task(value: ITask) {
		this.selectedTask = value;
		this._task = value;
	}

	/*
	* Payment Mutation Form 
	*/
	public form: FormGroup = AddTaskDialogComponent.buildForm(this.fb, this);
	static buildForm(
		fb: FormBuilder,
		self: AddTaskDialogComponent
	): FormGroup {
		return fb.group({
			title: ['', Validators.required],
			project: [],
			projectId: [],
			status: [self.getTranslation('TASKS_PAGE.TODO')],
			members: [],
			estimateDays: [],
			estimateHours: [ '', [Validators.min(0), Validators.max(23)]],
			estimateMinutes: ['', [Validators.min(0), Validators.max(59)]],
			dueDate: [],
			description: [],
			tags: [],
			teams: []
		});
	}

	constructor(
		public readonly dialogRef: NbDialogRef<AddTaskDialogComponent>,
		private readonly fb: FormBuilder,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly tasksService: TasksService,
		private readonly organizationTeamsService: OrganizationTeamsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this.loadEmployees()),
				tap(() => this.loadTeams()),
				tap(() => this.initializeForm()),
				untilDestroyed(this)
			)
			.subscribe();		
	}

	initializeForm() {
		if (this.selectedTask) {
			const { description, dueDate, estimate, members, project, status, tags, teams, title } = this.selectedTask;
			const duration = moment.duration(estimate, 'seconds');

			this.selectedMembers = (members || []).map((member) => member.id);
			this.selectedTeams = (teams || []).map((team) => team.id);

			if (teams && teams.length > 0) {
				this.participants = TaskParticipantEnum.TEAMS;
			}

			this.form.patchValue({
				title,
				project,
				projectId: (project) ? project.id : null,
				status,
				estimateDays: duration.days(),
				estimateHours: duration.hours(),
				estimateMinutes: duration.minutes(),
				dueDate: moment(dueDate).toDate(),
				description,
				tags,
				teams: this.selectedTeams
			});
		}
	}

	onSave() {
		if (this.form.valid) {
			this.form
				.get('members')
				.setValue((this.selectedMembers || []).map((id) => this.employees.find((e) => e.id === id)).filter((e) => !!e));
			this.form
				.get('teams')
				.setValue((this.selectedTeams || []).map((id) => this.teams.find((e) => e.id === id)) .filter((e) => !!e));

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
			} else {
				this.dialogRef.close(this.form.value);
			}
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.patchValue({ tags: currentSelection });
	}

	selectedProject(project: IOrganizationProject) {
		this.form.patchValue({ project });
	}

	async loadEmployees() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items = [] } = await this.employeesService.getAll(['user'], {
			organizationId,
			tenantId
		}).pipe(first()).toPromise();
		this.employees = items;
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}

	async loadTeams() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items = [] } = await this.organizationTeamsService.getAll(
			['members'],
			{ organizationId, tenantId }
		);
		this.teams = items;
	}

	onParticipantsChange(participants: TaskParticipantEnum) {
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
