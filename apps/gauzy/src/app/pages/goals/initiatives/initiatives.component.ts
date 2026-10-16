import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, firstValueFrom, tap } from 'rxjs';
import {
	ID,
	IOrganization,
	IOrganizationStrategicInitiativeRead,
	IOrganizationStrategicSignals,
	IOrganizationTeam,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	OrganizationTeamsService,
	Store,
	StrategicInitiativesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { AlertModalComponent } from '@gauzy/ui-core/shared';
import { InitiativeMutationComponent } from './initiative-mutation/initiative-mutation.component';
import { parseInitiativeSignals } from './initiative-signals';

/**
 * Goals → Initiatives: the strategic initiatives of the selected organization the user may see (the server
 * applies the `leadership` / `organization` / `team` visibility), with their state, visibility, directly
 * linked teams, aligned projects and signals. Creating, editing and deleting follow the
 * `ORG_STRATEGIC_INITIATIVE_*` permissions.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-strategic-initiatives',
	templateUrl: './initiatives.component.html',
	styleUrls: ['./initiatives.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class InitiativesComponent extends TranslationBaseComponent implements OnInit {
	public readonly PermissionsEnum = PermissionsEnum;
	public initiatives: IOrganizationStrategicInitiativeRead[] = [];
	public loading = false;
	public organization: IOrganization;
	private teamsById = new Map<ID, IOrganizationTeam>();

	constructor(
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly strategicInitiativesService: StrategicInitiativesService,
		private readonly organizationTeamsService: OrganizationTeamsService,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				distinctUntilChange(),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.load()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Loads the initiatives the user may see, and the organization's teams to name the linked ones. */
	async load(): Promise<void> {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		this.loading = true;
		try {
			const [initiatives, teams] = await Promise.all([
				this.strategicInitiativesService.getAll(organizationId, tenantId),
				this.organizationTeamsService
					.getAll([], { organizationId, tenantId })
					.catch(() => ({ items: [] as IOrganizationTeam[], total: 0 }))
			]);
			this.initiatives = initiatives?.items ?? [];
			this.teamsById = new Map((teams?.items ?? []).map((team) => [team.id, team]));
		} catch (error) {
			this.errorHandlingService.handleError(error);
		} finally {
			this.loading = false;
			this.cdr.markForCheck();
		}
	}

	/** The names of the teams an initiative is linked to directly. */
	teamNames(initiative: IOrganizationStrategicInitiativeRead): string[] {
		const ids = initiative.teamIds ?? (initiative.teams ?? []).map((team) => team.id);
		return ids.map((id) => this.teamsById.get(id)?.name ?? initiative.teams?.find((t) => t.id === id)?.name ?? id);
	}

	signals(initiative: IOrganizationStrategicInitiativeRead): IOrganizationStrategicSignals {
		return parseInitiativeSignals(initiative.signals);
	}

	open(initiative: IOrganizationStrategicInitiativeRead): void {
		this.router.navigate(['/pages/goals/initiatives', initiative.id]);
	}

	/** Opens the create (no initiative) or edit dialog, and reloads when it saved. */
	async edit(initiative?: IOrganizationStrategicInitiativeRead): Promise<void> {
		const dialog = this.dialogService.open(InitiativeMutationComponent, {
			context: { initiative, organization: this.organization },
			closeOnBackdropClick: false
		});
		const saved = await firstValueFrom(dialog.onClose);
		if (saved) {
			await this.load();
		}
	}

	async delete(initiative: IOrganizationStrategicInitiativeRead): Promise<void> {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.getTranslation('STRATEGIC_INITIATIVES.DELETE_TITLE'),
					message: this.getTranslation('STRATEGIC_INITIATIVES.DELETE_CONFIRMATION', {
						name: initiative.title
					}),
					status: 'danger'
				}
			},
			closeOnBackdropClick: false
		});
		const response = await firstValueFrom(dialog.onClose);
		if (response !== 'yes') {
			return;
		}
		try {
			await this.strategicInitiativesService.delete(initiative.id);
			this.toastrService.success('STRATEGIC_INITIATIVES.DELETED', { name: initiative.title });
			await this.load();
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}
}
