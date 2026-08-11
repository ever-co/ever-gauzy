/**
 * `@gauzy/ui-core/i18n` and `@gauzy/ui-core/core` are barrels over the whole app: importing
 * them pulls Akita's untranspiled ESM into the CommonJS test runtime. The dialog only needs
 * `TranslationBaseComponent` to exist and `Store.hasPermission` to answer, so both are stubbed
 * and the component is constructed directly — no `TestBed` (see `documents.service.spec.ts`).
 */
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { Observable, of, throwError } from 'rxjs';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { LegacyImportDialogComponent } from './legacy-import-dialog.component';
import {
	ILegacyImportInput,
	ILegacyImportReport,
	ILegacyRollbackInput,
	ILegacyRollbackReport,
	isDryRunSatisfied,
	LegacyImportSource,
	sumImportTotals
} from './legacy-import.model';

/**
 * The rule this file exists for: **a real import is only reachable through a dry run of
 * exactly the sources being imported** (`09-consolidation-migration.md` §10.2, steps 4 → 5).
 *
 * It is the one safety property of this screen that cannot be recovered from: the endpoint
 * writes `Document` rows for every legacy record it maps, and the only way back is the
 * rollback in §8 — which deliberately refuses to touch anything the user has edited since.
 * So the gate is asserted in three places and pinned here in all three:
 *
 *  1. `canRunImport` — the disabled state of the button;
 *  2. `confirmImport()` — re-checked at request time, because a source toggle (or a previous
 *     real run) can invalidate the report *while the confirmation is on screen*; and
 *  3. `isDryRunSatisfied()` — the pure predicate both of the above call.
 *
 * The second is the interesting one: a gate that only lives in a template condition is a gate
 * that a stale `[disabled]` binding can walk straight through.
 */

const ORGANIZATION_ID = 'bbbbbbbb-1111-4111-8111-111111111111' as ID;
const TENANT_ID = 'bbbbbbbb-2222-4222-8222-222222222222' as ID;

const BOTH_SOURCES: LegacyImportSource[] = ['organization-document', 'help-center'];

/** Builds a report shaped exactly like the endpoint's §5.4 body. */
function importReport(overrides: Partial<ILegacyImportReport> = {}): ILegacyImportReport {
	return {
		reportId: 'report-1',
		dryRun: true,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		requestedByUserId: null,
		sources: [...BOTH_SOURCES],
		startedAt: '2026-08-06T09:12:03.000Z',
		finishedAt: '2026-08-06T09:12:41.000Z',
		totals: {
			organizationDocuments: { scanned: 14, created: 11, skipped: 2, failed: 1, warnings: 3 },
			helpCenterNodes: { scanned: 9, created: 9, skipped: 0, failed: 0, warnings: 1 },
			helpCenterArticles: { scanned: 42, created: 40, skipped: 2, failed: 0, warnings: 5 },
			helpCenterVersions: { scanned: 17, created: 17, skipped: 0, failed: 0, warnings: 0 }
		},
		records: [
			{
				source: 'help-center-article',
				externalId: '8d0f',
				legacyName: 'Getting started',
				action: 'created',
				documentId: null,
				parentDocumentId: null,
				warnings: ['duplicate-name-suffixed'],
				error: null
			},
			{
				source: 'organization-document',
				externalId: '4c1a',
				legacyName: 'Handbook',
				action: 'failed',
				documentId: null,
				parentDocumentId: null,
				warnings: ['missing-file-asset'],
				error: { code: 'db-write-failed', message: 'duplicate key value violates unique constraint' }
			}
		],
		...overrides
	};
}

function rollbackReport(overrides: Partial<ILegacyRollbackReport> = {}): ILegacyRollbackReport {
	return {
		reportId: 'rollback-1',
		dryRun: false,
		force: false,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		requestedByUserId: null,
		sources: [...BOTH_SOURCES],
		startedAt: '2026-08-06T10:00:00.000Z',
		finishedAt: '2026-08-06T10:00:09.000Z',
		totals: { scanned: 77, deleted: 75, skippedModified: 1, skippedHasChildren: 1 },
		records: [],
		...overrides
	};
}

/** Records every request and answers with whatever the test queued. */
class LegacyImportServiceStub {
	public readonly imports: ILegacyImportInput[] = [];
	public readonly rollbacks: ILegacyRollbackInput[] = [];
	public importResponse: () => Observable<ILegacyImportReport> = () => of(importReport());
	public rollbackResponse: () => Observable<ILegacyRollbackReport> = () => of(rollbackReport());

	importLegacy(input: ILegacyImportInput): Observable<ILegacyImportReport> {
		this.imports.push(input);
		return this.importResponse();
	}

	rollbackLegacy(input: ILegacyRollbackInput): Observable<ILegacyRollbackReport> {
		this.rollbacks.push(input);
		return this.rollbackResponse();
	}
}

class StoreStub {
	constructor(private readonly granted: PermissionsEnum[]) {}
	hasPermission(permission: PermissionsEnum): boolean {
		return this.granted.includes(permission);
	}
}

interface IHarness {
	component: LegacyImportDialogComponent;
	service: LegacyImportServiceStub;
	dialogRef: { close: jest.Mock };
}

function harness(granted: PermissionsEnum[] = [PermissionsEnum.DOCS_MANAGE]): IHarness {
	const service = new LegacyImportServiceStub();
	const dialogRef = { close: jest.fn() };
	const component = new LegacyImportDialogComponent(
		{} as never,
		dialogRef as never,
		service as never,
		new StoreStub(granted) as never
	);
	return { component, service, dialogRef };
}

describe('legacy import — the dry-run-before-a-real-run rule', () => {
	describe('isDryRunSatisfied (the predicate)', () => {
		it('refuses when there is no report at all', () => {
			expect(isDryRunSatisfied(null, BOTH_SOURCES)).toBe(false);
		});

		it('refuses a report from a REAL run — its rows are already in the hub', () => {
			expect(isDryRunSatisfied(importReport({ dryRun: false }), BOTH_SOURCES)).toBe(false);
		});

		it('refuses a dry run of a different source set', () => {
			const report = importReport({ sources: ['organization-document'] });

			expect(isDryRunSatisfied(report, BOTH_SOURCES)).toBe(false);
			expect(isDryRunSatisfied(importReport(), ['organization-document'])).toBe(false);
		});

		it('accepts the same set in any order — the wire carries a set, not a sequence', () => {
			const report = importReport({ sources: ['help-center', 'organization-document'] });

			expect(isDryRunSatisfied(report, ['organization-document', 'help-center'])).toBe(true);
		});

		it('refuses an empty selection, which the endpoint would silently expand to both', () => {
			expect(isDryRunSatisfied(importReport(), [])).toBe(false);
		});
	});

	describe('the dialog', () => {
		it('offers a dry run and nothing else before anything has run', () => {
			const { component } = harness();

			expect(component.canRunDryRun).toBe(true);
			expect(component.canRunImport).toBe(false);
		});

		it('does not even open the confirmation without a dry run', () => {
			const { component, service } = harness();

			component.requestImport();

			expect(component.confirmingImport).toBe(false);
			expect(service.imports).toHaveLength(0);
		});

		it('sends dryRun: true explicitly — an omitted flag would be a server-side default', async () => {
			const { component, service } = harness();

			await component.runDryRun();

			expect(service.imports).toEqual([{ dryRun: true, sources: BOTH_SOURCES }]);
			expect(component.canRunImport).toBe(true);
		});

		it('drops the gate again when the source selection changes under the report', async () => {
			const { component } = harness();
			await component.runDryRun();

			component.toggleSource('help-center', false);

			expect(component.selectedSources).toEqual(['organization-document']);
			expect(component.canRunImport).toBe(false);
			expect(component.dryRunStale).toBe(true);
		});

		it('refuses the real run when the rule broke while the confirmation was open', async () => {
			const { component, service } = harness();
			await component.runDryRun();
			component.requestImport();
			expect(component.confirmingImport).toBe(true);

			// The button is disabled at this point — but a stale binding, a keyboard
			// activation or a second dialog instance must not be able to get past it.
			component.toggleSource('help-center', false);
			await component.confirmImport();

			expect(service.imports).toHaveLength(1);
			expect(service.imports[0].dryRun).toBe(true);
			expect(component.importReport).toBeNull();
		});

		it('runs for real only after the confirmation, and with dryRun: false', async () => {
			const { component, service } = harness();
			await component.runDryRun();
			component.requestImport();

			service.importResponse = () => of(importReport({ dryRun: false }));
			await component.confirmImport();

			expect(service.imports).toHaveLength(2);
			expect(service.imports[1]).toEqual({ dryRun: false, sources: BOTH_SOURCES });
			expect(component.importReport?.dryRun).toBe(false);
			expect(component.confirmingImport).toBe(false);
		});

		it('consumes the dry run — a second real run needs a fresh one', async () => {
			const { component, service } = harness();
			await component.runDryRun();
			component.requestImport();
			service.importResponse = () => of(importReport({ dryRun: false }));
			await component.confirmImport();

			expect(component.dryRunReport).toBeNull();
			expect(component.canRunImport).toBe(false);

			component.requestImport();
			await component.confirmImport();

			expect(service.imports).toHaveLength(2);
		});

		it('never unlocks the real run off the real run\'s own report', async () => {
			const { component, service } = harness();
			service.importResponse = () => of(importReport({ dryRun: false }));

			// Even if the server answered a dry-run request with a real-run report, the
			// client trusts the `dryRun` flag on the body it got back, not the one it sent.
			await component.runDryRun();

			expect(component.canRunImport).toBe(false);
		});

		it('keeps every run behind DOCS_MANAGE', async () => {
			const { component, service } = harness([]);

			expect(component.canManage).toBe(false);
			expect(component.canRunDryRun).toBe(false);
			await component.runDryRun();

			expect(service.imports).toHaveLength(0);
		});
	});

	describe('progress and failures', () => {
		it('reports the phase while the (synchronous, slow) call is in flight', async () => {
			const { component, service } = harness();
			let phaseDuringCall: string | null = null;
			service.importResponse = () => {
				phaseDuringCall = component.busy;
				return of(importReport());
			};

			await component.runDryRun();

			expect(phaseDuringCall).toBe('dry-run');
			expect(component.busy).toBeNull();
		});

		it('maps the 409 lock into copy that says to try again, and keeps the gate shut', async () => {
			const { component, service } = harness();
			service.importResponse = () =>
				throwError(() => ({ status: 409, error: { error: 'migration-in-progress' } }));

			await component.runDryRun();

			expect(component.errorMessage).toBe('DOCS.MIGRATION.ERROR_IN_PROGRESS');
			expect(component.busy).toBeNull();
			expect(component.canRunImport).toBe(false);
		});

		it('maps a 403 rather than showing a raw error', async () => {
			const { component, service } = harness();
			service.importResponse = () => throwError(() => ({ status: 403 }));

			await component.runDryRun();

			expect(component.errorMessage).toBe('DOCS.MIGRATION.ERROR_FORBIDDEN');
		});
	});

	describe('rollback', () => {
		it('needs DOCS_DELETE on top of DOCS_MANAGE — the service asserts it, so the UI does too', async () => {
			const { component, service } = harness([PermissionsEnum.DOCS_MANAGE]);

			expect(component.canRollback).toBe(false);
			component.requestRollback();
			await component.confirmRollback();

			expect(component.confirmingRollback).toBe(false);
			expect(service.rollbacks).toHaveLength(0);
		});

		it('never fires from the button alone — the confirmation is a separate step', async () => {
			const { component, service } = harness([PermissionsEnum.DOCS_MANAGE, PermissionsEnum.DOCS_DELETE]);

			component.requestRollback();

			expect(component.confirmingRollback).toBe(true);
			expect(service.rollbacks).toHaveLength(0);

			await component.confirmRollback();

			expect(service.rollbacks).toEqual([{ dryRun: false, sources: BOTH_SOURCES }]);
		});

		it('never sends force: true — the rails the confirmation promises stay on', async () => {
			const { component, service } = harness([PermissionsEnum.DOCS_MANAGE, PermissionsEnum.DOCS_DELETE]);

			component.requestRollback();
			await component.confirmRollback();

			expect(service.rollbacks[0].force).toBeUndefined();
		});

		it('clears the import reports it just invalidated', async () => {
			const { component, service } = harness([PermissionsEnum.DOCS_MANAGE, PermissionsEnum.DOCS_DELETE]);
			await component.runDryRun();
			component.requestImport();
			service.importResponse = () => of(importReport({ dryRun: false }));
			await component.confirmImport();

			component.requestRollback();
			await component.confirmRollback();

			expect(component.importReport).toBeNull();
			expect(component.dryRunReport).toBeNull();
			expect(component.rollbackReport?.totals.deleted).toBe(75);
		});
	});

	describe('the report projections the dialog renders', () => {
		it('adds the four per-source blocks into one summary', () => {
			expect(sumImportTotals(importReport())).toEqual({
				scanned: 82,
				created: 77,
				skipped: 4,
				failed: 1,
				warnings: 9
			});
		});

		it('lists the failed records with their error, and tallies the warnings', async () => {
			const { component } = harness();
			await component.runDryRun();

			expect(component.failures).toHaveLength(1);
			expect(component.failures[0].error?.code).toBe('db-write-failed');
			expect(component.errorLabelKey(component.failures[0])).toBe('DOCS.MIGRATION.ERROR_CODES.DB_WRITE_FAILED');
			expect(component.warnings).toEqual([
				{ code: 'duplicate-name-suffixed', count: 1 },
				{ code: 'missing-file-asset', count: 1 }
			]);
		});

		it('shows the dry run until a real run replaces it', async () => {
			const { component, service } = harness();
			await component.runDryRun();

			expect(component.report?.dryRun).toBe(true);

			component.requestImport();
			service.importResponse = () => of(importReport({ dryRun: false }));
			await component.confirmImport();

			expect(component.report?.dryRun).toBe(false);
		});
	});

	describe('closing', () => {
		it('reports no change after a dry run — the opener must not re-query for nothing', async () => {
			const { component, dialogRef } = harness();
			await component.runDryRun();

			component.close();

			expect(dialogRef.close).toHaveBeenCalledWith({ changed: false });
		});

		it('reports a change once a real run created rows', async () => {
			const { component, service, dialogRef } = harness();
			await component.runDryRun();
			component.requestImport();
			service.importResponse = () => of(importReport({ dryRun: false }));
			await component.confirmImport();

			component.close();

			expect(dialogRef.close).toHaveBeenCalledWith({ changed: true });
		});
	});
});
