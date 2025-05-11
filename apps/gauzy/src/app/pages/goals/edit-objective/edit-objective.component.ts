import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import {
	IEmployee,
	IGoal,
	IGoalTimeFrame,
	GoalLevelEnum,
	TimeFrameStatusEnum,
	RolesEnum,
	IOrganizationTeam,
	IGoalGeneralSetting,
	GoalOwnershipEnum,
	IOrganization,
	IUser
} from '@gauzy/contracts';
import { GoalSettingsService, OrganizationTeamsService, Store } from '@gauzy/ui-core/core';
import { debounceTime, filter, firstValueFrom, tap } from 'rxjs';
import { EditTimeFrameComponent } from '../../goal-settings/edit-time-frame/edit-time-frame.component';
import { isFuture } from 'date-fns';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-objective-mutation',
    templateUrl: './edit-objective.component.html',
    styleUrls: ['./edit-objective.component.scss'],
    standalone: false
})
export class EditObjectiveComponent implements OnInit, OnDestroy {
	employees: IEmployee[] = [];
	data: IGoal;
	timeFrames: IGoalTimeFrame[] = [];
	orgId: string;
	orgName: string;
	goalLevelEnum = GoalLevelEnum;
	hideEmployee = false;
	hideTeam = false;
	hideOrg = false;
	helperText = '';
	settings: IGoalGeneralSetting;
	teams: IOrganizationTeam[] = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	public organization: IOrganization;

	/*
	 * Objective Mutation Form
	 */
	public form: UntypedFormGroup = EditObjectiveComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: ['', Validators.required],
			description: [''],
			ownerId: [null, Validators.required],
			leadId: [null],
			level: [GoalLevelEnum.ORGANIZATION, Validators.required],
			deadline: ['', Validators.required]
		});
	}

	constructor(
		private readonly dialogRef: NbDialogRef<EditObjectiveComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly goalSettingService: GoalSettingsService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly organizationTeamsService: OrganizationTeamsService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				debounceTime(200),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getTimeFrames()),
				tap(() => this.patchValueAndValidity()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => this.selectorsVisibility(user)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectorsVisibility(user: IUser) {
		const roles = [RolesEnum.SUPER_ADMIN, RolesEnum.MANAGER, RolesEnum.ADMIN];
		this.hideOrg = !roles.includes(user.role.name as RolesEnum);
		this.hideEmployee = this.settings && this.settings.canOwnObjectives === GoalOwnershipEnum.TEAMS;
		this.hideTeam = this.settings && this.settings.canOwnObjectives === GoalOwnershipEnum.EMPLOYEES;
	}

	patchValueAndValidity() {
		if (!!this.data) {
			this.form.patchValue(this.data);
			this.form.patchValue({
				leadId: !!this.data.lead ? this.data.lead.id : null,
				ownerId: !!this.data.ownerEmployee
					? this.data.ownerEmployee.id
					: !!this.data.ownerTeam
					? this.data.ownerTeam.id
					: this.data.organization.id
			});
			if (this.data.level === GoalLevelEnum.TEAM) {
				this.getTeams();
			}
		}
		this.form.controls['level'].updateValueAndValidity();
	}

	async getTeams() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.teams = (
			await this.organizationTeamsService.getAll(['members'], {
				organizationId,
				tenantId
			})
		).items;
	}

	async getTimeFrames() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const findObj = {
			organization: {
				id: organizationId
			},
			tenantId
		};
		await this.goalSettingService.getAllTimeFrames(findObj).then(({ items }) => {
			if (items) {
				let timeFrames = [];
				timeFrames = items.filter(
					(timeFrame) =>
						timeFrame.status === TimeFrameStatusEnum.ACTIVE && isFuture(new Date(timeFrame.endDate))
				);
				if (!!this.data) {
					timeFrames.push(items.find((timeFrame) => this.data.deadline === timeFrame.name));
				}
				this.timeFrames = timeFrames.filter((elm) => elm);
			}
		});
	}

	async openSetTimeFrame() {
		const dialog = this.dialogService.open(EditTimeFrameComponent, {
			context: {
				type: 'add'
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (response) {
			await this.getTimeFrames();
		}
	}

	saveObjective() {
		const { id: organizationId, tenantId } = this.organization;
		const objectiveData = {
			...{ organizationId, tenantId },
			...this.form.value
		};
		objectiveData[
			this.form.value.level === GoalLevelEnum.EMPLOYEE
				? 'ownerEmployee'
				: this.form.value.level === GoalLevelEnum.TEAM
				? 'ownerTeam'
				: 'organization'
		] = this.form.value.owner;
		delete objectiveData.owner;
		delete objectiveData.organization;
		if (this.form.invalid) return;
		this.closeDialog(objectiveData);
	}

	closeDialog(data = null) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {}
}
