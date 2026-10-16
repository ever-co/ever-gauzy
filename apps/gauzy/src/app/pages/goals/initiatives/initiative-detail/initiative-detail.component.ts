import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, firstValueFrom, map, tap } from 'rxjs';
import {
	ID,
	IEmployee,
	IGoal,
	IOrganization,
	IOrganizationStrategicInitiativeRead,
	IOrganizationStrategicSignals,
	IOrganizationTeam,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	EmployeesService,
	ErrorHandlingService,
	GoalService,
	OrganizationTeamsService,
	Store,
	StrategicInitiativesService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { InitiativeMutationComponent } from '../initiative-mutation/initiative-mutation.component';
import { parseInitiativeSignals } from '../initiative-signals';

/**
 * One strategic initiative: its intent, steward, state and visibility, its signals (confidence, momentum,
 * known risks, notes, last assessment), the teams it is linked to directly, and the goals and projects aligned
 * to it. Read-only, with an Edit button for holders of `ORG_STRATEGIC_INITIATIVE_UPDATE`.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-initiative-detail',
	templateUrl: './initiative-detail.component.html',
	styleUrls: ['./initiative-detail.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class InitiativeDetailComponent extends TranslationBaseComponent implements OnInit {
	public readonly PermissionsEnum = PermissionsEnum;
	public initiative: IOrganizationStrategicInitiativeRead | null = null;
	public goals: IGoal[] = [];
	public teams: IOrganizationTeam[] = [];
	public steward: IEmployee | null = null;
	public loading = false;
	public notFound = false;
	private initiativeId: ID;

	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly store = inject(Store);
	private readonly dialogService = inject(NbDialogService);
	private readonly strategicInitiativesService = inject(StrategicInitiativesService);
	private readonly goalService = inject(GoalService);
	private readonly employeesService = inject(EmployeesService);
	private readonly organizationTeamsService = inject(OrganizationTeamsService);
	private readonly errorHandlingService = inject(ErrorHandlingService);
	private readonly cdr = inject(ChangeDetectorRef);

	constructor() {
		super(inject(TranslateService));
	}

	ngOnInit(): void {
		this.route.paramMap
			.pipe(
				map((params) => params.get('id')),
				filter((id) => !!id),
				tap((id) => (this.initiativeId = id)),
				tap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	get signals(): IOrganizationStrategicSignals {
		return parseInitiativeSignals(this.initiative?.signals);
	}

	async load(): Promise<void> {
		this.loading = true;
		this.notFound = false;
		try {
			this.initiative = await this.strategicInitiativesService.getById(this.initiativeId, ['projects', 'teams']);
			const organizationId = this.initiative.organizationId;
			const tenantId = this.initiative.tenantId;
			const [goals, teams, employees] = await Promise.all([
				this.goalService
					.getAllGoals([], {
						organizationId,
						tenantId,
						organizationStrategicInitiativeId: this.initiative.id
					} as never)
					.catch(() => null),
				this.organizationTeamsService.getAll([], { organizationId, tenantId }).catch(() => null),
				this.initiative.stewardId
					? firstValueFrom(this.employeesService.getAll(['user'], { organizationId, tenantId })).catch(
							() => null
						)
					: Promise.resolve(null)
			]);
			this.goals = goals?.items ?? [];
			const teamIds = new Set(this.initiative.teamIds ?? (this.initiative.teams ?? []).map((team) => team.id));
			this.teams = (teams?.items ?? []).filter((team) => teamIds.has(team.id));
			if (this.teams.length === 0 && this.initiative.teams?.length) {
				this.teams = this.initiative.teams;
			}
			this.steward = employees?.items?.find((employee) => employee.id === this.initiative.stewardId) ?? null;
		} catch (error) {
			this.initiative = null;
			this.notFound = true;
			this.errorHandlingService.handleError(error);
		} finally {
			this.loading = false;
			this.cdr.markForCheck();
		}
	}

	stewardName(): string {
		const user = this.steward?.user;
		return user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—';
	}

	back(): void {
		this.router.navigate(['/pages/goals/initiatives']);
	}

	/**
	 * Opens the editor in the organization of the INITIATIVE (its employees and teams), whichever one is
	 * selected: a favorite can open an initiative of an organization other than the selected one.
	 */
	async edit(): Promise<void> {
		const selected = this.store.selectedOrganization;
		const organization =
			selected?.id === this.initiative.organizationId
				? selected
				: ({ id: this.initiative.organizationId, tenantId: this.initiative.tenantId } as IOrganization);
		const dialog = this.dialogService.open(InitiativeMutationComponent, {
			context: { initiative: this.initiative, organization },
			closeOnBackdropClick: false
		});
		if (await firstValueFrom(dialog.onClose)) {
			await this.load();
		}
	}
}
