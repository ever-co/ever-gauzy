import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	IEmployee,
	IOrganization,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationTeam,
	ISelectedEmployee,
	ITag,
	TaskParticipantEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	EmployeesService,
	OrganizationTeamsService,
	Store,
	OrganizationProjectModuleService,
	SprintService
} from '@gauzy/ui-core/core';
import { richTextCKEditorConfig } from '../../../ckeditor.config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-add-module-dialog',
	templateUrl: './add-project-module-dialog.component.html',
	styleUrls: ['./add-project-module-dialog.component.scss']
})
export class AddProjectModuleDialogComponent extends TranslationBaseComponent implements OnInit {
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	selectedMembers: string[] = [];
	selectedTeams: string[] = [];
	organizationSprints: IOrganizationSprint[] = [];
	availableParentModules: IOrganizationProjectModule[] = [];
	selectedProjectModule: IOrganizationProjectModule;
	organization: IOrganization;
	taskParticipantEnum = TaskParticipantEnum;
	participants = TaskParticipantEnum.EMPLOYEES;
	public ckConfig: CKEditor4.Config = richTextCKEditorConfig;
	@Input() createModule = false;
	/*
	 * Payment Mutation Form
	 */
	public form: UntypedFormGroup = AddProjectModuleDialogComponent.buildForm(this.fb);

	constructor(
		public readonly dialogRef: NbDialogRef<AddProjectModuleDialogComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly organizationProjectModuleService: OrganizationProjectModuleService,
		private readonly organizationSprintService: SprintService
	) {
		super(translateService);
	}

	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: [],
			description: [],
			status: [],
			startDate: [],
			endDate: [],
			isFavorite: [false],
			parentId: [],
			projectId: [],
			managerId: [],
			creatorId: [],
			members: [],
			organizationSprints: [],
			teams: [],
			tasks: []
		});
	}

	/*
	 * Getter & Setter for Project Module
	 */
	_projectModule: IOrganizationProjectModule;

	get projectModule(): IOrganizationProjectModule {
		return this._projectModule;
	}

	@Input() set projectModule(value: IOrganizationProjectModule) {
		this.selectedProjectModule = value;
		this._projectModule = value;
	}

	ngOnInit() {
		this.ckConfig.editorplaceholder = this.translateService.instant('FORM.PLACEHOLDERS.DESCRIPTION');
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeProject$ = this.store.selectedProject$;
		storeOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.loadEmployees()),
				tap(() => this.loadTeams()),
				tap(() => this.initializeForm()),
				untilDestroyed(this)
			)
			.subscribe();
		storeEmployee$
			.pipe(
				distinctUntilChange(),
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				tap((employee: ISelectedEmployee) => {
					if (!this.selectedProjectModule) {
						this.selectedMembers.push(employee.id);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		storeProject$
			.pipe(
				distinctUntilChange(),
				filter((project: IOrganizationProject) => !!project && !!project.id),
				tap((project: IOrganizationProject) => {
					if (!this.selectedProjectModule) {
						this.form.get('project').setValue(project);
						console.log(project);

						this.form.get('projectId').setValue(project.id);
						this.form.updateValueAndValidity();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.findOrganizationSprints();
		this.loadAvailableParentModules();
	}

	initializeForm() {
		if (this.selectedProjectModule) {
			const {
				name,
				description,
				status,
				startDate,
				endDate,
				isFavorite,
				projectId,
				parentId,
				managerId,
				creatorId,
				members,
				organizationSprints,
				teams,
				tasks
			} = this.selectedProjectModule;

			this.selectedMembers = (members || []).map((member) => member.id);
			this.selectedTeams = (teams || []).map((team) => team.id);

			if (teams && teams.length > 0) {
				this.participants = TaskParticipantEnum.TEAMS;
			}

			this.form.patchValue({
				name,
				description,
				status,
				startDate,
				endDate,
				isFavorite,
				projectId,
				parentId,
				managerId,
				creatorId,
				teams: this.selectedTeams,
				members: this.selectedMembers,
				organizationSprints,
				tasks
			});
		}
	}

	onSave() {
		if (this.form.valid) {
			// Reset both fields to ensure only one is sent based on the selection
			this.form.get('members').setValue([]);
			this.form.get('teams').setValue([]);

			if (this.participants === TaskParticipantEnum.EMPLOYEES) {
				this.form.get('members').setValue(
					(this.selectedMembers || []).map((id) => this.employees.find((e) => e.id === id)).filter((e) => !!e) // Only valid employees
				);
			} else if (this.participants === TaskParticipantEnum.TEAMS) {
				this.form.get('teams').setValue(
					(this.selectedTeams || []).map((id) => this.teams.find((e) => e.id === id)).filter((e) => !!e) // Only valid teams
				);
			}
			this.form.get('status').setValue(this.form.get('taskStatus').value?.name);

			if (this.createModule) {
				firstValueFrom(this.organizationProjectModuleService.create(this.form.value)).then((module) => {
					this.dialogRef.close(module);
				});
			} else {
				this.dialogRef.close(this.form.value);
			}
		}
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	selectedProject(project: IOrganizationProject) {
		this.form.get('project').setValue(project);
		this.form.get('project').updateValueAndValidity();
	}

	async loadEmployees() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organizationId,
				tenantId
			})
		);
		this.employees = items;
	}

	onMembersSelected(members: string[]) {
		this.selectedMembers = members;
	}

	async loadTeams() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items = [] } = await this.organizationTeamsService.getAll(['members'], { organizationId, tenantId });
		this.teams = items;
	}
	private async loadAvailableParentModules() {
		if (!this.organization) return;
		const { id: organizationId } = this.organization;

		const modules = await firstValueFrom(
			this.organizationProjectModuleService.findModulesByProject(this.form.get('projectId')?.value)
		);
		this.availableParentModules = modules || [];
	}
	findOrganizationSprints(): void {
		this.organizationSprintService.getAllSprints().subscribe(
			(sprints: IOrganizationSprint[]) => {
				this.organizationSprints = sprints;
			},
			(error) => {
				console.error('Error fetching organization sprints:', error);
			}
		);
	}
	onParticipantsChange(participants: TaskParticipantEnum) {
		this.participants = participants;
	}

	onTeamsSelected(teamsSelection: string[]) {
		this.selectedTeams = teamsSelection;
	}
	onManagerSelected(selectedManagerId: number): void {
		this.form.get('managerId').setValue(selectedManagerId);
	}
}
