import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IEmployee,
	IOrganization,
	IOrganizationStrategicInitiativeRead,
	IOrganizationStrategicSignals,
	IOrganizationTeam,
	OrganizationStrategicConfidenceLevelEnum,
	OrganizationStrategicPerceivedMomentumEnum,
	OrganizationStrategicStateEnum,
	OrganizationStrategicVisibilityScopeEnum
} from '@gauzy/contracts';
import {
	EmployeesService,
	ErrorHandlingService,
	OrganizationTeamsService,
	StrategicInitiativesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { parseInitiativeSignals } from '../initiative-signals';

/**
 * Creates or edits a strategic initiative: title, intent, state, visibility, steward, the teams it is linked
 * to directly, and its qualitative signals (confidence, momentum, known risks, notes). Closes with the saved
 * initiative, or nothing when cancelled.
 */
@Component({
	selector: 'ga-initiative-mutation',
	templateUrl: './initiative-mutation.component.html',
	styleUrls: ['./initiative-mutation.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class InitiativeMutationComponent extends TranslationBaseComponent implements OnInit {
	/** The initiative to edit; absent to create one. */
	public initiative?: IOrganizationStrategicInitiativeRead;
	public organization: IOrganization;

	public form: UntypedFormGroup;
	public saving = false;
	public employees: IEmployee[] = [];
	public teams: IOrganizationTeam[] = [];

	public readonly states = Object.values(OrganizationStrategicStateEnum);
	public readonly visibilityScopes = Object.values(OrganizationStrategicVisibilityScopeEnum);
	public readonly confidenceLevels = Object.values(OrganizationStrategicConfidenceLevelEnum);
	public readonly momentums = Object.values(OrganizationStrategicPerceivedMomentumEnum);

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<InitiativeMutationComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly strategicInitiativesService: StrategicInitiativesService,
		private readonly employeesService: EmployeesService,
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly toastrService: ToastrService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const signals = parseInitiativeSignals(this.initiative?.signals);
		const teamIds = this.initiative?.teamIds ?? (this.initiative?.teams ?? []).map((team) => team.id);
		this.form = this.fb.group({
			title: [this.initiative?.title ?? '', Validators.required],
			intent: [this.initiative?.intent ?? ''],
			state: [this.initiative?.state ?? OrganizationStrategicStateEnum.DRAFT, Validators.required],
			visibilityScope: [
				this.initiative?.visibilityScope ?? OrganizationStrategicVisibilityScopeEnum.ORGANIZATION,
				Validators.required
			],
			stewardId: [this.initiative?.stewardId ?? null],
			teamIds: [teamIds],
			confidenceLevel: [signals.confidenceLevel ?? null],
			perceivedMomentum: [signals.perceivedMomentum ?? null],
			knownRisks: [(signals.knownRisks ?? []).join('\n')],
			strategicNotes: [signals.strategicNotes ?? '']
		});
		this.loadOptions();
	}

	get isEdit(): boolean {
		return !!this.initiative?.id;
	}

	/** The organization's employees (for the steward) and teams (for the direct links). */
	private async loadOptions(): Promise<void> {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const [employees, teams] = await Promise.all([
			firstValueFrom(this.employeesService.getAll(['user'], { organizationId, tenantId })).catch(() => null),
			this.organizationTeamsService.getAll([], { organizationId, tenantId }).catch(() => null)
		]);
		this.employees = employees?.items ?? [];
		this.teams = teams?.items ?? [];
		this.cdr.markForCheck();
	}

	employeeName(employee: IEmployee): string {
		return employee?.user?.name || [employee?.user?.firstName, employee?.user?.lastName].filter(Boolean).join(' ');
	}

	/** The signals the form states. Known risks are one per line. */
	private formSignals(): IOrganizationStrategicSignals {
		const { confidenceLevel, perceivedMomentum, knownRisks, strategicNotes } = this.form.value;
		return {
			...(confidenceLevel ? { confidenceLevel } : {}),
			...(perceivedMomentum ? { perceivedMomentum } : {}),
			knownRisks: String(knownRisks ?? '')
				.split('\n')
				.map((risk) => risk.trim())
				.filter(Boolean),
			strategicNotes: strategicNotes ?? ''
		};
	}

	async save(): Promise<void> {
		if (this.form.invalid || this.saving) {
			return;
		}
		const { title, intent, state, visibilityScope, stewardId, teamIds } = this.form.value;
		const values = {
			title: String(title).trim(),
			intent,
			state,
			visibilityScope,
			...(stewardId ? { stewardId: stewardId as ID } : {}),
			teamIds: (teamIds ?? []) as ID[]
		};
		this.saving = true;
		try {
			let saved;
			if (this.isEdit) {
				saved = await this.strategicInitiativesService.update(this.initiative.id, values);
				// The signals are merged into the stored document and stamped with this assessment.
				saved = await this.strategicInitiativesService.updateSignals(this.initiative.id, this.formSignals());
				this.toastrService.success('STRATEGIC_INITIATIVES.UPDATED', { name: values.title });
			} else {
				saved = await this.strategicInitiativesService.create({
					...values,
					organizationId: this.organization.id,
					tenantId: this.organization.tenantId,
					signals: this.formSignals()
				});
				this.toastrService.success('STRATEGIC_INITIATIVES.CREATED', { name: values.title });
			}
			this.dialogRef.close(saved);
		} catch (error) {
			this.errorHandlingService.handleError(error);
		} finally {
			this.saving = false;
			this.cdr.markForCheck();
		}
	}

	cancel(): void {
		this.dialogRef.close(null);
	}
}
