import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import {
	ILegacyImportInput,
	ILegacyImportReport,
	ILegacyRollbackInput,
	ILegacyRollbackReport
} from './legacy-import.model';

/**
 * HTTP client for the two legacy-consolidation endpoints of `@gauzy/plugin-docs`
 * (`09-consolidation-migration.md` §5.1 / §8). Both are `DOCS_MANAGE`-gated, synchronous
 * (the full pass runs on the request thread and returns the report), and answer 409
 * `{ error: 'migration-in-progress' }` while another run holds the per-organization lock.
 *
 * 🛑 Three things about the wire contract that are easy to get wrong:
 *
 *  1. The rollback route is **`/import-legacy/rollback`**, not the `/rollback` printed in
 *     the spec's §5.1 table — `LegacyImportController` nests it under the import route.
 *  2. `dryRun` is always sent explicitly. `ImportLegacyDTO` defaults it to **`true`**, so an
 *     omitted flag turns a real import into a dry run that reports plausible numbers and
 *     writes nothing.
 *  3. Both endpoints validate with `forbidNonWhitelisted: true`, so only the four fields the
 *     DTO declares may go on the body — an extra key is a 400 for the whole request, not a
 *     silently stripped extra. The organization scope is required (`TenantOrganizationBaseDTO`
 *     validates `organizationId` whenever no `organization`/`sentTo` is present).
 */
@Injectable()
export class LegacyImportService {
	private readonly API_URL = `${API_PREFIX}/plugins/docs/migrations`;

	constructor(private readonly http: HttpClient, private readonly store: Store) {}

	/**
	 * Runs — or dry-runs — the import of the legacy Organization Documents and Help Center data.
	 *
	 * @param input The sources to scan and whether this is a dry run.
	 * @returns The per-record migration report (identical shape for both modes).
	 */
	importLegacy(input: ILegacyImportInput): Observable<ILegacyImportReport> {
		return this.http.post<ILegacyImportReport>(`${this.API_URL}/import-legacy`, this.toBody(input));
	}

	/**
	 * Soft-deletes the documents a previous import created. The legacy tables are untouched by
	 * construction — only rows carrying a migration `externalSource` are considered.
	 *
	 * Requires `DOCS_DELETE` on top of `DOCS_MANAGE` (asserted by the service, not the route
	 * guard, because `PermissionGuard` composes `@Permissions(...)` with OR semantics).
	 *
	 * @param input The sources to roll back and whether this is a dry run.
	 * @returns The per-document rollback report.
	 */
	rollbackLegacy(input: ILegacyRollbackInput): Observable<ILegacyRollbackReport> {
		return this.http.post<ILegacyRollbackReport>(`${this.API_URL}/import-legacy/rollback`, this.toBody(input));
	}

	/** Builds the request body: the declared DTO fields only, plus the organization scope. */
	private toBody(input: ILegacyImportInput | ILegacyRollbackInput): Record<string, unknown> {
		const organization = this.store.selectedOrganization;
		const force = (input as ILegacyRollbackInput).force;
		return {
			dryRun: input.dryRun,
			sources: input.sources,
			...(force === undefined ? {} : { force }),
			...(organization?.id ? { organizationId: organization.id as ID } : {}),
			...(organization?.tenantId ? { tenantId: organization.tenantId as ID } : {})
		};
	}
}
