import { Component, OnInit, ViewChild, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import {
	ID,
	IGoalTemplate,
	IGoalTimeFrame,
	IKeyResultTemplate,
	TimeFrameStatusEnum,
	IEmployee,
	IOrganizationTeam,
	GoalLevelEnum,
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
import {
	buildGoalFromTemplate,
	buildKeyResultFromTemplate,
	buildKpiFromTemplate,
	IGoalPresetForm,
	IGoalPresetScope,
	keyResultOwnerId
} from './goal-from-template';
import { GoalPresetRollback } from './goal-preset-rollback';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-goal-template-select',
    templateUrl: './goal-template-select.component.html',
    styleUrls: ['./goal-template-select.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
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

	/**
	 * Creates the KPIs of the selected preset's KPI key results, then the objective and its key results.
	 *
	 * Every payload is built field by field (`goal-from-template.ts`): the template's own ids never reach the
	 * requests, so the same preset can be used again and again, each time creating records of its own (#4825).
	 *
	 * The preset is saved whole or not at all: when a step fails, the records the earlier steps of this attempt
	 * created are removed again (`GoalPresetRollback`), so no KPI is left without its key result and trying again
	 * does not create a second set. A record that cannot be removed is named in a warning.
	 */
	async createGoal() {
		// Read once: another preset picked while the requests below are pending must not mix into this one
		const template = this.selectedGoalTemplate;
		if (!template || !this.form.valid) {
			return;
		}

		const form: IGoalPresetForm = this.form.value;
		const { id: organizationId, tenantId } = this.organization;
		const scope: IGoalPresetScope = { organizationId, tenantId };
		const keyResultTemplates = template.keyResults ?? [];

		// A key result must be owned by an employee: checked before anything is created, so a preset is never
		// left half-made (an objective without its key results)
		const user = this.store.user;
		const ownerId = keyResultOwnerId(form, user?.employee?.id ?? user?.employeeId);
		if (keyResultTemplates.length > 0 && !ownerId) {
			this.toastrService.error(this.getTranslation('TOASTR.MESSAGE.KEY_RESULTS_OWNER_REQUIRED'));
			return;
		}

		// What this attempt has created so far, removed again if a later step fails
		const rollback = new GoalPresetRollback();

		try {
			// Create the KPI of each KPI key result first. A KPI key result is only saved with its KPI (the key result
			// screens read the linked KPI), so when one cannot be created, the objective is not created either
			const kpiIds = new Map<IKeyResultTemplate, ID>();
			for (const keyResult of keyResultTemplates.filter(({ type }) => type === KeyResultTypeEnum.KPI)) {
				const kpiId = await this.createKpi(keyResult, scope);
				if (!kpiId) {
					await this.abandonPreset(rollback);
					return;
				}
				rollback.add(keyResult.kpi?.name || keyResult.name, () => this.goalSettingsService.deleteKPI(kpiId));
				kpiIds.set(keyResult, kpiId);
			}

			// Create the goal
			const goalCreated = await this.goalService.createGoal(
				buildGoalFromTemplate(template, form, scope)
			);
			if (!goalCreated) {
				await this.abandonPreset(rollback);
				return;
			}
			// Removing the objective removes its key results with it (`key_result.goalId` cascades)
			rollback.add(goalCreated.name || template.name, () => this.goalService.delete(goalCreated.id));

			// Then its key results, each KPI key result linked to the KPI created for it
			const keyResults = keyResultTemplates.map((keyResult) =>
				buildKeyResultFromTemplate(
					keyResult,
					{ goalId: goalCreated.id, ownerId, kpiId: kpiIds.get(keyResult) },
					scope
				)
			);

			// Create Key Results in bulk
			const keyResultsCreated = await this.keyResultService.createBulkKeyResult(keyResults);
			if (!keyResultsCreated) {
				await this.abandonPreset(rollback);
				return;
			}
			this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.KEY_RESULTS_CREATED'));
			this.closeDialog('done');
		} catch (error) {
			console.error('Goal creation failed:', error);
			this.toastrService.error(
				this.getTranslation('TOASTR.MESSAGE.GOAL_CREATION_ERROR', {
					error: error.message || 'Unknown error'
				})
			);
			await this.removeCreatedRecords(rollback);
		}
	}

	/**
	 * Reports that the preset could not be created, and removes what this attempt had created.
	 *
	 * @param rollback The records this attempt created.
	 */
	private async abandonPreset(rollback: GoalPresetRollback): Promise<void> {
		this.toastrService.error(this.getTranslation('TOASTR.MESSAGE.GOAL_CREATION_FAILED'));
		await this.removeCreatedRecords(rollback);
	}

	/**
	 * Removes the records a failed attempt created, and names in a warning any that could not be removed, so the
	 * user can delete them from Goals or Goal Settings.
	 *
	 * @param rollback The records this attempt created.
	 */
	private async removeCreatedRecords(rollback: GoalPresetRollback): Promise<void> {
		const notRemoved = await rollback.undo();
		if (notRemoved.length > 0) {
			this.toastrService.warning(
				this.getTranslation('TOASTR.MESSAGE.GOAL_PRESET_ROLLBACK_FAILED', { names: notRemoved.join(', ') })
			);
		}
	}

	/**
	 * Creates the KPI a KPI key result template describes, in the selected organization.
	 *
	 * @returns The new KPI's id, or `undefined` (with a warning naming it) when it could not be created; the
	 *   caller then creates nothing more.
	 */
	private async createKpi(keyResult: IKeyResultTemplate, scope: IGoalPresetScope): Promise<ID | undefined> {
		try {
			if (!keyResult.kpi) {
				throw new Error(`Key result template ${keyResult.name} has no KPI`);
			}
			const kpi = await this.goalSettingsService.createKPI(buildKpiFromTemplate(keyResult.kpi, scope));
			this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.KPI_CREATED', { name: keyResult.name }));
			return kpi?.id;
		} catch {
			this.toastrService.warning(
				this.getTranslation('TOASTR.MESSAGE.KPI_CREATION_FAILED', { name: keyResult.name })
			);
			return undefined;
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
