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
	 * Creates the objective, the KPIs of its KPI key results, and its key results from the selected preset.
	 *
	 * Every payload is built field by field (`goal-from-template.ts`): the template's own ids never reach the
	 * requests, so the same preset can be used again and again, each time creating records of its own (#4825).
	 */
	async createGoal() {
		if (!this.selectedGoalTemplate || !this.form.valid) {
			return;
		}

		const form: IGoalPresetForm = this.form.value;
		const { id: organizationId, tenantId } = this.organization;
		const scope: IGoalPresetScope = { organizationId, tenantId };
		const keyResultTemplates = this.selectedGoalTemplate.keyResults ?? [];

		// A key result must be owned by an employee: checked before anything is created, so a preset is never
		// left half-made (an objective without its key results)
		const user = this.store.user;
		const ownerId = keyResultOwnerId(form, user?.employee?.id ?? user?.employeeId);
		if (keyResultTemplates.length > 0 && !ownerId) {
			this.toastrService.error(this.getTranslation('TOASTR.MESSAGE.KEY_RESULTS_OWNER_REQUIRED'));
			return;
		}

		try {
			// Create the goal
			const goalCreated = await this.goalService.createGoal(
				buildGoalFromTemplate(this.selectedGoalTemplate, form, scope)
			);
			if (!goalCreated) {
				this.toastrService.error(this.getTranslation('TOASTR.MESSAGE.GOAL_CREATION_FAILED'));
				return;
			}

			// Create the KPI of each KPI key result, then the key results themselves
			const keyResults = await Promise.all(
				keyResultTemplates.map(async (keyResult) => {
					const kpiId =
						keyResult.type === KeyResultTypeEnum.KPI ? await this.createKpi(keyResult, scope) : undefined;
					return buildKeyResultFromTemplate(keyResult, { goalId: goalCreated.id, ownerId, kpiId }, scope);
				})
			);

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

	/**
	 * Creates the KPI a KPI key result template describes, in the selected organization.
	 *
	 * @returns The new KPI's id, or `undefined` (with a warning) when it could not be created: the key result is
	 *   then created without a KPI, as before, never pointing at the template's KPI.
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
