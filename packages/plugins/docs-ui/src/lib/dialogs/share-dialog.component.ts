import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
	DocumentShareAccessEnum,
	DocumentVisibilityEnum,
	ID,
	IDocument,
	IDocumentShare,
	IEmployee,
	IOrganizationTeam,
	PermissionsEnum
} from '@gauzy/contracts';
import { EmployeesService, OrganizationTeamsService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	DOCS_SHARE_ACCESS_LEVELS,
	DOCS_SHARE_ERROR_CODES,
	DocsShareTargetKind,
	IDocumentShareCreateInput
} from '../models/docs-share.model';
import { DocumentsService } from '../services/documents.service';
import { DOCS_PERMISSIONS } from '../docs-permission-groups';

/** Row projection: the share plus a resolved display label for its subject. */
interface IShareRow {
	share: IDocumentShare;
	label: string;
	kind: DocsShareTargetKind;
	/** Per-row in-flight guard so one revoke does not freeze the whole list. */
	busy: boolean;
}

/**
 * Share overlay editor for a document (`08-permissions-security.md` §3,
 * `01-ux-spec.md` §8). Opened from the detail panel and the page-editor overflow
 * menu; everything mutating is `DOCS_UPDATE`-gated.
 *
 * Two blocks:
 *
 *  1. **Visibility** — `ORGANIZATION` ⇄ `PRIVATE` with an explanatory hint.
 *     Shares only mean anything on PRIVATE documents (an ORGANIZATION document
 *     is already readable org-wide and `POST /shares` answers 409
 *     `DOCS_SHARE_NOT_PRIVATE`), so the share block is disabled — not hidden —
 *     while visibility is ORGANIZATION, with the reason spelled out. Hiding it
 *     would leave the user hunting for a control that exists.
 *  2. **Shares** — existing rows (employee or team + VIEW/COMMENT/EDIT), an add
 *     form, inline access changes and revoke.
 *
 * 🛑 The dialog states the §3.3 composition invariant in the access hint:
 * `EDIT` still requires the subject to hold `DOCS_UPDATE`. A share never
 * substitutes for a permission, and promising otherwise in the UI is the kind
 * of thing people plan access around.
 *
 * **Feature detection:** the share endpoints are P1 in `03-backend-plugin.md`.
 * A 404 on the initial `GET /shares` is treated as "this deployment has no
 * share endpoints yet" and renders an unavailable notice — never an error toast
 * (an error a user cannot act on is noise).
 *
 * The employee picker deliberately does **not** reuse `ga-employee-multi-select`:
 * that component gates rendering on `DateRangePickerBuilderService.selectedDateRange$`,
 * which never emits on Documents routes because `docs.routes.ts` disables the
 * header date selector (`selectors: { date: false }`) — it would render an empty
 * box here. The team picker does reuse `ga-team-selector` (no such coupling),
 * with `skipGlobalChange` so picking a team never rewrites global nav state.
 */
@Component({
	selector: 'gz-document-share-dialog',
	templateUrl: './share-dialog.component.html',
	styleUrls: ['./share-dialog.component.scss'],
	providers: [EmployeesService],
	standalone: false
})
export class DocumentShareDialogComponent extends TranslationBaseComponent implements OnInit {
	/**
	 * Stable permission arrays for the template's `*ngxPermissionsOnly` gates.
	 * 🛑 Never inline `[permissions.X]` in a binding — a fresh array each change-detection cycle
	 * makes ngx-permissions re-validate forever and wedges the main thread.
	 */
	public readonly docsPermissions = DOCS_PERMISSIONS;

	/** The document to share. Required. */
	@Input() document!: IDocument;

	public rows: IShareRow[] = [];
	public employees: IEmployee[] = [];
	public teams: IOrganizationTeam[] = [];

	public loading = false;
	public saving = false;
	/** True once `GET /shares` answered 404 — the P1 endpoints are not deployed. */
	public unsupported = false;
	/** True after a 403/404 on a mutation the user turned out not to be allowed. */
	public forbidden = false;

	// Add-share form
	public targetKind: DocsShareTargetKind = 'employee';
	public selectedEmployeeId: ID | null = null;
	public selectedTeamId: ID | null = null;
	public newAccess: DocumentShareAccessEnum = DocumentShareAccessEnum.VIEW;

	public visibility: DocumentVisibilityEnum = DocumentVisibilityEnum.ORGANIZATION;

	public readonly accessLevels = DOCS_SHARE_ACCESS_LEVELS;
	public readonly visibilities = [DocumentVisibilityEnum.ORGANIZATION, DocumentVisibilityEnum.PRIVATE];
	public readonly visibilityEnum = DocumentVisibilityEnum;
	public readonly permissions = PermissionsEnum;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<DocumentShareDialogComponent>,
		private readonly documentsService: DocumentsService,
		private readonly employeesService: EmployeesService,
		private readonly teamsService: OrganizationTeamsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.visibility = this.document?.visibility ?? DocumentVisibilityEnum.ORGANIZATION;
		void this.reload();
	}

	// ─── Loading ─────────────────────────────────────────────────

	async reload(): Promise<void> {
		if (!this.document?.id) return;
		this.loading = true;
		try {
			const [shares, employees, teams] = await Promise.all([
				firstValueFrom(
					this.documentsService.getShares(this.document.id as ID).pipe(
						catchError((error: { status?: number }) => {
							// 404 = endpoints absent (P1) OR the document is not visible
							// to this user; either way there is nothing to show.
							if (error?.status === 404) this.unsupported = true;
							if (error?.status === 403) this.forbidden = true;
							return of([] as IDocumentShare[]);
						})
					)
				),
				this.loadEmployees(),
				this.loadTeams()
			]);
			this.employees = employees;
			this.teams = teams;
			this.rows = (shares ?? []).map((share) => this.toRow(share));
		} finally {
			this.loading = false;
		}
	}

	private async loadEmployees(): Promise<IEmployee[]> {
		const { organizationId, tenantId } = this.orgContext();
		if (!organizationId) return [];
		const result = await firstValueFrom(
			this.employeesService
				.getAll(['user'], { organizationId, tenantId })
				.pipe(catchError(() => of({ items: [], total: 0 })))
		);
		return result?.items ?? [];
	}

	private async loadTeams(): Promise<IOrganizationTeam[]> {
		const { organizationId, tenantId } = this.orgContext();
		if (!organizationId) return [];
		try {
			const result = await this.teamsService.getAll([], { organizationId, tenantId });
			return result?.items ?? [];
		} catch {
			return [];
		}
	}

	// ─── Visibility ──────────────────────────────────────────────

	get isPrivate(): boolean {
		return this.visibility === DocumentVisibilityEnum.PRIVATE;
	}

	/**
	 * Flipping to ORGANIZATION does **not** delete existing shares: they simply
	 * stop granting anything (§3.3 — shares have no effect on ORGANIZATION
	 * documents) and come back if the document goes PRIVATE again. Silently
	 * dropping rows on a visibility toggle would be a surprising data loss.
	 */
	async onVisibilityChange(visibility: DocumentVisibilityEnum): Promise<void> {
		if (!this.document || visibility === this.visibility) return;
		const previous = this.visibility;
		this.visibility = visibility;
		this.saving = true;
		try {
			this.document = await firstValueFrom(
				this.documentsService.update(this.document.id as ID, { visibility })
			);
			this.visibility = this.document.visibility ?? visibility;
			this.toastrService.success(this.getTranslation('DOCS.TOASTS.VISIBILITY_UPDATED'));
		} catch (error) {
			this.visibility = previous; // revert
			this.toastrService.danger(error);
		} finally {
			this.saving = false;
		}
	}

	// ─── Shares ──────────────────────────────────────────────────

	get canAdd(): boolean {
		if (!this.isPrivate || this.unsupported || this.saving) return false;
		return this.targetKind === 'employee' ? !!this.selectedEmployeeId : !!this.selectedTeamId;
	}

	onTargetKindChange(kind: DocsShareTargetKind): void {
		this.targetKind = kind;
		this.selectedEmployeeId = null;
		this.selectedTeamId = null;
	}

	onTeamPicked(team: IOrganizationTeam | null): void {
		this.selectedTeamId = (team?.id as ID) ?? null;
	}

	async addShare(): Promise<void> {
		if (!this.canAdd || !this.document) return;
		const { organizationId, tenantId } = this.orgContext();
		const input: IDocumentShareCreateInput = {
			access: this.newAccess,
			organizationId,
			tenantId,
			// XOR — exactly one target, or the backend answers 400 DOCS_SHARE_TARGET.
			...(this.targetKind === 'employee'
				? { employeeId: this.selectedEmployeeId as ID }
				: { teamId: this.selectedTeamId as ID })
		};
		this.saving = true;
		try {
			const share = await firstValueFrom(this.documentsService.createShare(this.document.id as ID, input));
			this.rows = [...this.rows, this.toRow(share)];
			this.selectedEmployeeId = null;
			this.selectedTeamId = null;
			this.newAccess = DocumentShareAccessEnum.VIEW;
			this.toastrService.success(this.getTranslation('DOCS.SHARE.TOAST_ADDED'));
		} catch (error) {
			this.handleShareError(error);
		} finally {
			this.saving = false;
		}
	}

	async changeAccess(row: IShareRow, access: DocumentShareAccessEnum): Promise<void> {
		if (!this.document || row.busy || access === row.share.access) return;
		const previous = row.share.access;
		row.busy = true;
		row.share = { ...row.share, access }; // optimistic
		try {
			const updated = await firstValueFrom(
				this.documentsService.updateShare(this.document.id as ID, row.share.id as ID, { access })
			);
			row.share = { ...row.share, ...updated };
		} catch (error) {
			row.share = { ...row.share, access: previous }; // revert
			this.handleShareError(error);
		} finally {
			row.busy = false;
		}
	}

	async revoke(row: IShareRow): Promise<void> {
		if (!this.document || row.busy) return;
		row.busy = true;
		try {
			await firstValueFrom(this.documentsService.deleteShare(this.document.id as ID, row.share.id as ID));
			this.rows = this.rows.filter((entry) => entry.share.id !== row.share.id);
			this.toastrService.success(this.getTranslation('DOCS.SHARE.TOAST_REVOKED'));
		} catch (error) {
			row.busy = false;
			this.handleShareError(error);
		}
	}

	// ─── Helpers ─────────────────────────────────────────────────

	employeeLabel(employee: IEmployee): string {
		return (
			employee?.fullName ||
			employee?.user?.name ||
			[employee?.user?.firstName, employee?.user?.lastName].filter(Boolean).join(' ') ||
			employee?.user?.email ||
			String(employee?.id ?? '')
		);
	}

	/** Employees already holding a share are not offered again (duplicate ⇒ 409). */
	get availableEmployees(): IEmployee[] {
		const taken = new Set(this.rows.map((row) => String(row.share.employeeId ?? '')));
		return this.employees.filter((employee) => !taken.has(String(employee.id)));
	}

	get availableTeams(): IOrganizationTeam[] {
		const taken = new Set(this.rows.map((row) => String(row.share.teamId ?? '')));
		return this.teams.filter((team) => !taken.has(String(team.id)));
	}

	trackRow(_: number, row: IShareRow): string {
		return String(row.share.id);
	}

	close(): void {
		// Resolves with the (possibly re-fetched) document so the opener can
		// refresh its visibility chip without another round trip.
		this.dialogRef.close(this.document ?? null);
	}

	private toRow(share: IDocumentShare): IShareRow {
		const kind: DocsShareTargetKind = share.teamId ? 'team' : 'employee';
		const label = kind === 'team' ? this.teamShareLabel(share) : this.employeeShareLabel(share);
		return { share, label, kind, busy: false };
	}

	/** Team name off the share, then the loaded catalog, then the bare id. */
	private teamShareLabel(share: IDocumentShare): string {
		return (
			share.team?.name ??
			this.teams.find((team) => String(team.id) === String(share.teamId))?.name ??
			String(share.teamId ?? '')
		);
	}

	/** Employee off the share, else the loaded catalog, else an id-only stub. */
	private employeeShareLabel(share: IDocumentShare): string {
		if (share.employee) return this.employeeLabel(share.employee);
		const employee = this.employees.find((candidate) => String(candidate.id) === String(share.employeeId));
		return this.employeeLabel(employee ?? ({ id: share.employeeId } as IEmployee));
	}

	/** Maps the documented share error codes onto readable copy; falls back to the raw error. */
	private handleShareError(error: unknown): void {
		const code = (error as { error?: { code?: string } })?.error?.code;
		if (code === DOCS_SHARE_ERROR_CODES.NOT_PRIVATE) {
			this.toastrService.danger(this.getTranslation('DOCS.SHARE.ERROR_NOT_PRIVATE'));
			return;
		}
		if (code === DOCS_SHARE_ERROR_CODES.TARGET) {
			this.toastrService.danger(this.getTranslation('DOCS.SHARE.ERROR_TARGET'));
			return;
		}
		if ((error as { status?: number })?.status === 409) {
			this.toastrService.danger(this.getTranslation('DOCS.SHARE.ERROR_DUPLICATE'));
			return;
		}
		if ((error as { status?: number })?.status === 404) {
			this.unsupported = true;
			return;
		}
		this.toastrService.danger(error);
	}

	private orgContext(): { organizationId?: ID; tenantId?: ID } {
		const organization = this.store.selectedOrganization;
		return organization ? { organizationId: organization.id, tenantId: organization.tenantId } : {};
	}
}
