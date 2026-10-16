import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IOrganizationStrategicInitiative,
	IOrganizationStrategicInitiativeCreateInput,
	IOrganizationStrategicInitiativeRead,
	IOrganizationStrategicInitiativeUpdateInput,
	IOrganizationStrategicSignals,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

/**
 * Organization strategic initiatives (`/api/organization-strategic-initiative`): the directions an organization
 * has decided to move in, with their steward, state, visibility, signals, directly linked teams (`teamIds`),
 * aligned projects and goals. The server applies the visibility rules; this service only reads and writes.
 */
@Injectable({
	providedIn: 'root'
})
export class StrategicInitiativesService {
	private readonly API_URL = `${API_PREFIX}/organization-strategic-initiative`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * The initiatives of an organization the caller may see (each with its projects and directly linked teams).
	 */
	getAll(organizationId: ID, tenantId: ID): Promise<IPagination<IOrganizationStrategicInitiativeRead>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationStrategicInitiativeRead>>(this.API_URL, {
				params: toParams({ where: { organizationId, tenantId } })
			})
		);
	}

	/** One initiative, with the relations named (its directly linked teams are always answered). */
	getById(id: ID, relations: string[] = []): Promise<IOrganizationStrategicInitiativeRead> {
		return firstValueFrom(
			this.http.get<IOrganizationStrategicInitiativeRead>(`${this.API_URL}/${id}`, {
				params: toParams({ relations })
			})
		);
	}

	create(input: IOrganizationStrategicInitiativeCreateInput): Promise<IOrganizationStrategicInitiative> {
		return firstValueFrom(this.http.post<IOrganizationStrategicInitiative>(this.API_URL, input));
	}

	update(id: ID, input: IOrganizationStrategicInitiativeUpdateInput): Promise<IOrganizationStrategicInitiative> {
		return firstValueFrom(this.http.put<IOrganizationStrategicInitiative>(`${this.API_URL}/${id}`, input));
	}

	/** Merges the stated signals into the initiative's signals and stamps the assessment. */
	updateSignals(id: ID, signals: IOrganizationStrategicSignals): Promise<IOrganizationStrategicInitiative> {
		return firstValueFrom(
			this.http.put<IOrganizationStrategicInitiative>(`${this.API_URL}/${id}/signals`, signals)
		);
	}

	delete(id: ID): Promise<unknown> {
		return firstValueFrom(this.http.delete(`${this.API_URL}/${id}`));
	}
}
