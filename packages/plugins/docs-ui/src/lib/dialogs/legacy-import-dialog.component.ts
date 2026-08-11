import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	failedRecords,
	ILegacyImportRecord,
	ILegacyImportReport,
	ILegacyImportTotals,
	ILegacyRollbackReport,
	isDryRunSatisfied,
	LEGACY_IMPORT_ACTION_LABEL_KEYS,
	LEGACY_IMPORT_ERROR_LABEL_KEYS,
	LEGACY_IMPORT_SOURCE_LABEL_KEYS,
	LEGACY_IMPORT_SOURCES,
	LEGACY_IMPORT_TOTALS_ROWS,
	LEGACY_IMPORT_WARNING_LABEL_KEYS,
	LEGACY_MIGRATION_IN_PROGRESS,
	LEGACY_RECORD_SOURCE_LABEL_KEYS,
	LEGACY_ROLLBACK_ACTION_LABEL_KEYS,
	LEGACY_ROLLBACK_TOTALS_ROWS,
	LegacyImportSource,
	LegacyImportWarning,
	sumImportTotals,
	warningCounts
} from './legacy-import.model';
import { LegacyImportService } from './legacy-import.service';

/** What the dialog is currently waiting on — also the label of the progress row. */
export type LegacyImportPhase = 'dry-run' | 'import' | 'rollback';

/** Closed with this so the opener knows whether the hub's contents changed. */
export interface ILegacyImportDialogResult {
	/** `true` after a real import created rows, or a real rollback removed some. */
	changed: boolean;
}

/**
 * "Import legacy data" — the `DOCS_MANAGE`-gated migration entry point named by
 * `09-consolidation-migration.md` §10.4, opened from the Documents page header overflow menu.
 *
 * It drives the §10.2 rollout playbook, in order:
 *
 *  1. pick the legacy sources (both by default);
 *  2. **dry run** — the endpoint's own default, and the only action offered until one has run;
 *  3. read the report (per-source totals, warning tally, expandable per-record failures);
 *  4. **confirm** the real run, which is refused until step 2 covered exactly these sources;
 *  5. optionally **roll back**, behind its own confirmation.
 *
 * 🛑 The dry-run gate is not cosmetic and is not a template-only condition. `RUN` is disabled
 * without a matching dry run *and* {@link confirmImport} re-asserts the rule before it issues
 * the request, because everything that can invalidate the report — toggling a source, a
 * previous real run replacing it — happens while the confirmation is on screen. It is pinned
 * by `legacy-import-dialog.component.spec.ts`.
 *
 * The run is synchronous server-side and can take a while on a large Help Center, so every
 * control is disabled for the duration and the phase is spelled out rather than left to a
 * spinner alone.
 */
@Component({
	selector: 'gz-docs-legacy-import-dialog',
	templateUrl: './legacy-import-dialog.component.html',
	styleUrls: ['./legacy-import-dialog.component.scss'],
	standalone: false
})
export class LegacyImportDialogComponent extends TranslationBaseComponent {
	public readonly sourceOptions = LEGACY_IMPORT_SOURCES;
	public readonly sourceLabelKeys = LEGACY_IMPORT_SOURCE_LABEL_KEYS;
	public readonly totalsRows = LEGACY_IMPORT_TOTALS_ROWS;
	public readonly rollbackTotalsRows = LEGACY_ROLLBACK_TOTALS_ROWS;

	/** Sources the next run will scan. Both by default, matching the endpoint's own default. */
	public selectedSources: LegacyImportSource[] = [...LEGACY_IMPORT_SOURCES];

	/** The dry-run report that unlocks the real run — dropped the moment it stops applying. */
	public dryRunReport: ILegacyImportReport | null = null;
	/** The report of the last real import. */
	public importReport: ILegacyImportReport | null = null;
	/** The report of the last rollback (dry or real). */
	public rollbackReport: ILegacyRollbackReport | null = null;

	/** Non-null while a request is in flight — every control is disabled meanwhile. */
	public busy: LegacyImportPhase | null = null;
	public confirmingImport = false;
	public confirmingRollback = false;
	/** Translated, already-resolved failure copy; `null` while nothing has failed. */
	public errorMessage: string | null = null;

	public errorsExpanded = false;
	public warningsExpanded = false;

	public readonly canManage: boolean;
	public readonly canRollback: boolean;

	constructor(
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<LegacyImportDialogComponent>,
		private readonly legacyImportService: LegacyImportService,
		private readonly store: Store
	) {
		super(translateService);
		this.canManage = this.store.hasPermission(PermissionsEnum.DOCS_MANAGE);
		// §8 requires DOCS_MANAGE **and** DOCS_DELETE. The route guard only enforces the
		// former (OR semantics), so a user without DOCS_DELETE would get a 403 from the
		// service — offering the button would make it a dead control.
		this.canRollback = this.canManage && this.store.hasPermission(PermissionsEnum.DOCS_DELETE);
	}

	// ─── Sources ─────────────────────────────────────────────────

	isSourceSelected(source: LegacyImportSource): boolean {
		return this.selectedSources.includes(source);
	}

	/**
	 * Changing the source set invalidates the report on screen: its counts describe other
	 * data. The dry run is not silently reused — {@link dryRunStale} says so out loud.
	 */
	toggleSource(source: LegacyImportSource, checked: boolean): void {
		if (this.busy) return;
		this.selectedSources = checked
			? [...this.selectedSources.filter((entry) => entry !== source), source]
			: this.selectedSources.filter((entry) => entry !== source);
		this.confirmingImport = false;
	}

	// ─── Gates ───────────────────────────────────────────────────

	get canRunDryRun(): boolean {
		return this.canManage && !this.busy && this.selectedSources.length > 0;
	}

	/** A real run needs a dry run of exactly these sources — the §10.2 step-4-before-5 rule. */
	get canRunImport(): boolean {
		return this.canManage && !this.busy && isDryRunSatisfied(this.dryRunReport, this.selectedSources);
	}

	/** A dry run exists but no longer describes what would be imported. */
	get dryRunStale(): boolean {
		return !!this.dryRunReport && !isDryRunSatisfied(this.dryRunReport, this.selectedSources);
	}

	get canConfirmRollback(): boolean {
		return this.canRollback && !this.busy;
	}

	/** Documents the confirmed run would create, per the dry run the user is looking at. */
	get plannedCreateCount(): number {
		return sumImportTotals(this.dryRunReport).created;
	}

	// ─── Runs ────────────────────────────────────────────────────

	/** Step 4 of the playbook: full read + mapping + validation pass, zero writes. */
	async runDryRun(): Promise<void> {
		if (!this.canRunDryRun) return;
		this.confirmingImport = false;
		this.confirmingRollback = false;
		this.importReport = null;
		this.rollbackReport = null;
		await this.run('dry-run', async () => {
			this.dryRunReport = await firstValueFrom(
				this.legacyImportService.importLegacy({ dryRun: true, sources: [...this.selectedSources] })
			);
		});
	}

	/** Opens the confirmation for the real run (never issues it). */
	requestImport(): void {
		if (!this.canRunImport) return;
		this.confirmingRollback = false;
		this.confirmingImport = true;
	}

	cancelImport(): void {
		this.confirmingImport = false;
	}

	/**
	 * Step 5: the real import.
	 *
	 * Re-checks the dry-run rule rather than trusting the disabled state of the button that
	 * called it, and drops the dry-run report afterwards — the legacy rows it described are
	 * now imported, so a second real run must be preceded by a fresh dry run.
	 */
	async confirmImport(): Promise<void> {
		if (!this.canRunImport) return;
		await this.run('import', async () => {
			this.importReport = await firstValueFrom(
				this.legacyImportService.importLegacy({ dryRun: false, sources: [...this.selectedSources] })
			);
			this.dryRunReport = null;
			this.confirmingImport = false;
		});
	}

	/** Opens the rollback confirmation (never issues it). */
	requestRollback(): void {
		if (!this.canConfirmRollback) return;
		this.confirmingImport = false;
		this.confirmingRollback = true;
	}

	cancelRollback(): void {
		this.confirmingRollback = false;
	}

	/**
	 * Soft-deletes the migrated documents. `force` is never sent: the default rails skip
	 * migrated documents edited since the import and migrated folders that hold documents the
	 * migration did not create, which is the behaviour the confirmation copy promises.
	 */
	async confirmRollback(): Promise<void> {
		if (!this.canConfirmRollback) return;
		await this.run('rollback', async () => {
			this.rollbackReport = await firstValueFrom(
				this.legacyImportService.rollbackLegacy({ dryRun: false, sources: [...this.selectedSources] })
			);
			// The hub's contents changed under every other report on screen.
			this.dryRunReport = null;
			this.importReport = null;
			this.confirmingRollback = false;
		});
	}

	/** Shared in-flight/error envelope — one request at a time, one place that maps failures. */
	private async run(phase: LegacyImportPhase, request: () => Promise<void>): Promise<void> {
		this.busy = phase;
		this.errorMessage = null;
		try {
			await request();
		} catch (error) {
			this.errorMessage = this.toErrorMessage(error);
		} finally {
			this.busy = null;
		}
	}

	/** Maps the documented failures onto copy the admin can act on. */
	private toErrorMessage(error: unknown): string {
		const status = (error as { status?: number })?.status;
		const code = (error as { error?: { error?: string } })?.error?.error;
		if (status === 409 || code === LEGACY_MIGRATION_IN_PROGRESS) {
			return this.getTranslation('DOCS.MIGRATION.ERROR_IN_PROGRESS');
		}
		if (status === 403) {
			return this.getTranslation('DOCS.MIGRATION.ERROR_FORBIDDEN');
		}
		return this.getTranslation('DOCS.MIGRATION.ERROR_FAILED');
	}

	// ─── Report projections ──────────────────────────────────────

	/** The import report on screen: the real run's when there is one, else the dry run's. */
	get report(): ILegacyImportReport | null {
		return this.importReport ?? this.dryRunReport;
	}

	get combinedTotals(): ILegacyImportTotals {
		return sumImportTotals(this.report);
	}

	get failures(): ILegacyImportRecord[] {
		return failedRecords(this.report);
	}

	get warnings(): { code: LegacyImportWarning; count: number }[] {
		return warningCounts(this.report);
	}

	/** A finished run that found nothing at all — a real outcome, not an error. */
	get reportIsEmpty(): boolean {
		return !!this.report && this.combinedTotals.scanned === 0;
	}

	recordSourceLabelKey(record: ILegacyImportRecord): string {
		return LEGACY_RECORD_SOURCE_LABEL_KEYS[record.source] ?? 'DOCS.MIGRATION.REPORT.RECORD_SOURCE_UNKNOWN';
	}

	actionLabelKey(record: ILegacyImportRecord): string {
		return LEGACY_IMPORT_ACTION_LABEL_KEYS[record.action] ?? 'DOCS.MIGRATION.ACTIONS.FAILED';
	}

	errorLabelKey(record: ILegacyImportRecord): string {
		const code = record.error?.code;
		return (code && LEGACY_IMPORT_ERROR_LABEL_KEYS[code]) || 'DOCS.MIGRATION.ERROR_CODES.DB_WRITE_FAILED';
	}

	warningLabelKey(code: LegacyImportWarning): string {
		return LEGACY_IMPORT_WARNING_LABEL_KEYS[code] ?? 'DOCS.MIGRATION.REPORT.WARNINGS';
	}

	rollbackActionLabelKey(record: { action: keyof typeof LEGACY_ROLLBACK_ACTION_LABEL_KEYS }): string {
		return LEGACY_ROLLBACK_ACTION_LABEL_KEYS[record.action] ?? 'DOCS.MIGRATION.ROLLBACK.ACTIONS.DELETED';
	}

	trackRecord(_: number, record: ILegacyImportRecord): string {
		return `${record.source}:${record.externalId}`;
	}

	trackWarning(_: number, warning: { code: LegacyImportWarning }): string {
		return warning.code;
	}

	// ─── Close ───────────────────────────────────────────────────

	/**
	 * Reports whether the hub changed, so the browse page reloads the list and the tree only
	 * when it has to. A dry run alone never counts as a change.
	 */
	close(): void {
		const created = sumImportTotals(this.importReport).created > 0;
		const deleted = !!this.rollbackReport && !this.rollbackReport.dryRun && this.rollbackReport.totals.deleted > 0;
		const result: ILegacyImportDialogResult = { changed: created || deleted };
		this.dialogRef.close(result);
	}
}
