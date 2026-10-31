import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IDeal, IDealCreateInput, IDealFindInput, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Service } from '../crud/service';

@Injectable()
export class DealsService extends Service<IDeal, IDealFindInput, IDealCreateInput> {
	constructor(override readonly http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/deals` });
	}

	/**
	 * Fetch all deals with optional relations and filter conditions
	 *
	 * @param relations Array of relation names to include in the result
	 * @param where Filter conditions for fetching deals
	 * @returns A promise of paginated deals
	 */
	getAll(relations?: string[], where?: IDealFindInput): Promise<IPagination<IDeal>> {
		return firstValueFrom(
			this.http.get<IPagination<IDeal>>(`${this.basePath}`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Fetch a deal by its ID with optional relations and filter conditions
	 *
	 * @param id The ID of the deal to fetch
	 * @param where Filter conditions for fetching the deal
	 * @param relations Array of relation names to include in the result
	 * @returns A promise of the fetched deal
	 */
	getById(id: ID, where?: IDealFindInput, relations: string[] = []): Promise<IDeal> {
		return firstValueFrom(
			this.http.get<IDeal>(`${this.basePath}/${id}`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Moves a deal to another stage, through the same update endpoint as the deal form. Only the stage is
	 * sent: a title or probability read when the page loaded would undo a newer edit made elsewhere.
	 *
	 * @param id The ID of the deal to move
	 * @param stageId The stage the deal moves to
	 * @param scope The organization and tenant the deal belongs to
	 * @returns A promise of the update result
	 */
	updateStage(id: ID, stageId: ID, scope: Pick<IDeal, 'organizationId' | 'tenantId'>): Promise<IDeal> {
		const { organizationId, tenantId } = scope;
		return this.update(id, { stageId, organizationId, tenantId } as IDealCreateInput);
	}
}
