import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	IGoalTemplate,
	IGoalTimeFrame,
	TimeFrameStatusEnum,
	IEmployee,
	IOrganizationTeam,
	GoalLevelEnum,
	KeyResultWeightEnum,
	KeyResultTypeEnum,
	IOrganization
} from '@gauzy/contracts';
import { isFuture } from 'date-fns';
import { NbDialogRef, NbDialogService, NbStepperComponent } from '@nebular/theme';
import { debounceTime, filter, firstValueFrom, tap } from 'rxjs';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	GoalService,
	GoalSettingsService,
	GoalTemplatesService,
	KeyResultService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslateService } from '@ngx-translate/core';
import { EditTimeFrameComponent } from '../../../pages/goal-settings/edit-time-frame/edit-time-frame.component';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-goal-template-select',
    templateUrl: './goal-template-select.component.html',
    styleUrls: ['./goal-template-select.component.scss'],
    standalone: false
})
export class GoalTemplateSelectComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	goalTemplates: IGoalTemplate[];
	selectedGoalTemplate: IGoalTemplate;
	timeFrames: IGoalTimeFrame[] = [];
	timeFrameStatusEnum = TimeFrameStatusEnum;
	employees: IEmployee[] = [];
	teams: IOrganizationTeam[] = [];
	orgId: string;
	orgName: string;

	public organization: IOrganization;
	@ViewChild('stepper') stepper: NbStepperComponent;

	/*
	 * Goal Template Selection Mutation Form
	 */
	public form: UntypedFormGroup = GoalTemplateSelectComponent.buildForm(this.fb, this);
	static buildForm(fb: UntypedFormBuilder, self: GoalTemplateSelectComponent): UntypedFormGroup {
		return fb.group({
			deadline: ['', Validators.required],
			ownerId: ['', Validators.required],
			level: [
				!!self.selectedGoalTemplate ? self.selectedGoalTemplate.level : GoalLevelEnum.ORGANIZATION,
				Validators.required
			],
			leadId: [null]
		});
	}

	constructor(
		private readonly goalTemplateService: GoalTemplatesService,
		private readonly goalSettingService: GoalSettingsService,
		private readonly store: Store,
		private readonly dialogRef: NbDialogRef<GoalTemplateSelectComponent>,
		private readonly dialogService: NbDialogService,
		private readonly goalService: GoalService,
		private readonly keyResultService: KeyResultService,
		private readonly fb: UntypedFormBuilder,
		private readonly goalSettingsService: GoalSettingsService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				debounceTime(200),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.getGoalTemplates()),
				tap(() => this.getTimeFrames()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getGoalTemplates() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.goalTemplateService.getAllGoalTemplates({ organizationId, tenantId }).then((res) => {
			const { items } = res;
			this.goalTemplates = items;
		});
	}

	async getTimeFrames() {
		const { id: organizationId, tenantId } = this.organization;
		const findObj = {
			organization: {
				id: organizationId
			},
			tenantId
		};
		await this.goalSettingService.getAllTimeFrames(findObj).then(({ items = [] }) => {
			this.timeFrames = items.filter(
				(timeFrame) => timeFrame.status === TimeFrameStatusEnum.ACTIVE && isFuture(new Date(timeFrame.endDate))
			);
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

	nextStep(goalTemplate) {
		this.stepper.next();
		this.selectedGoalTemplate = goalTemplate;
	}

	async createGoal() {
		if (!!this.selectedGoalTemplate && this.form.valid) {
			const formValue = this.form.value;

			const { id: organizationId, tenantId } = this.organization;
			const goal = {
				...this.selectedGoalTemplate,
				...formValue,
				description: ' ',
				progress: 0,
				organizationId,
				tenantId
			};
			goal[
				this.form.value.level === GoalLevelEnum.EMPLOYEE
					? 'ownerEmployeeId'
					: this.form.value.level === GoalLevelEnum.TEAM
					? 'ownerTeamId'
					: 'organizationId'
			] = this.form.value.ownerId;

			const { owner, keyResults, ...goalData } = goal;
			const newGoal = {
				...goalData,
				organizationId,
				tenantId
			};

			try {
				// Create the goal
				const goalCreated = await this.goalService.createGoal(newGoal);
				if (!goalCreated) {
					this.toastrService.error(this.getTranslation('TOASTR.MESSAGE.GOAL_CREATION_FAILED'));
					return;
				}

				// Create associated KPIs
				const kpiPromises = this.selectedGoalTemplate.keyResults.map(async (keyResult) => {
					if (keyResult.type === KeyResultTypeEnum.KPI) {
						const kpiData = {
							...keyResult.kpi,
							organization: this.orgId
						};
						try {
							const res = await this.goalSettingsService.createKPI(kpiData);
							keyResult.kpiId = res?.id;
							this.toastrService.success(
								this.getTranslation('TOASTR.MESSAGE.KPI_CREATED', { name: keyResult.name })
							);
						} catch (error) {
							this.toastrService.warning(
								this.getTranslation('TOASTR.MESSAGE.KPI_CREATION_FAILED', { name: keyResult.name })
							);
						}
						return keyResult;
					}
					return keyResult;
				});

				const KEY_RESULT_DEFAULTS = {
					description: ' ',
					progress: 0,
					status: 'none',
					weight: KeyResultWeightEnum.DEFAULT
				};

				// Wait for all KPI promises to complete
				const updatedKeyResults = await Promise.all(kpiPromises);

				// Prepare Key Results for bulk creation
				const keyResults = updatedKeyResults.map((keyResult) => {
					const { kpi, goalId, ...keyResultData } = keyResult;
					return {
						...keyResultData,
						...KEY_RESULT_DEFAULTS,
						goalId: goalCreated.id,
						update: keyResult.initialValue,
						ownerId: this.form.value.ownerId,
						organizationId,
						tenantId
					};
				});

				// Create Key Results in bulk
				const keyResultsCreated = await this.keyResultService.createBulkKeyResult(keyResults);
				if (keyResultsCreated) {
					this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.KEY_RESULTS_CREATED'));
					this.closeDialog('done');
				}
			} catch (error) {
				console.error('Goal creation failed:', error);
				this.toastrService.error(
					this.getTranslation('TOASTR.MESSAGE.GOAL_CREATION_ERROR', {
						error: error.message || 'Unknown error'
					})
				);
			}
		}
	}
	previousStep() {
		this.stepper.previous();
	}

	closeDialog(data) {
		this.dialogRef.close(data);
	}

	ngOnDestroy() {}
}
