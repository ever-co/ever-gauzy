import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { ID, IPagination, IProposal, IProposalCreateInput, IProposalFindInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ProposalsService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves all proposals with optional filtering by relations and conditions.
	 *
	 * @param relations - An array of strings specifying the related entities to include in the results.
	 * @param where - An optional object specifying the conditions to filter the proposals.
	 * @returns A promise that resolves to an object containing a list of proposals and pagination details.
	 */
	getAll(relations: string[] = [], where?: IProposalFindInput): Promise<IPagination<IProposal>> {
		return firstValueFrom(
			this.http.get<IPagination<IProposal>>(`${API_PREFIX}/proposal`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Creates a new proposal with the given input data.
	 *
	 * @param input - The data required to create a new proposal, conforming to the IProposalCreateInput interface.
	 * @returns A promise that resolves to the newly created proposal.
	 */
	create(input: IProposalCreateInput): Promise<IProposal> {
		return firstValueFrom(this.http.post<IProposal>(`${API_PREFIX}/proposal`, input));
	}

	/**
	 * Updates an existing proposal with the given ID using the provided input data.
	 *
	 * @param id - The unique identifier of the proposal to update.
	 * @param input - The data to update the proposal with, conforming to the IProposalCreateInput interface.
	 * @returns A promise that resolves to the updated proposal.
	 */
	update(id: ID, input: IProposalCreateInput): Promise<IProposal> {
		return firstValueFrom(this.http.put<IProposal>(`${API_PREFIX}/proposal/${id}`, input));
	}

	/**
	 * Deletes a proposal with the given ID.
	 *
	 * @param id - The unique identifier of the proposal to delete.
	 * @returns A promise that resolves to the deleted proposal.
	 */
	delete(id: ID): Promise<IProposal> {
		return firstValueFrom(this.http.delete<IProposal>(`${API_PREFIX}/proposal/${id}`));
	}

	/**
	 * Retrieves a proposal by its unique ID, with optional inclusion of related entities.
	 *
	 * @param id - The unique identifier of the proposal to retrieve.
	 * @param relations - An array of strings specifying the related entities to include in the result.
	 * @returns An observable that emits the retrieved proposal, enriched with the specified relations.
	 */
	getById(id: ID, relations: string[] = []): Observable<IProposal> {
		return this.http.get<IProposal>(`${API_PREFIX}/proposal/${id}`, {
			params: toParams({ relations })
		});
	}
}
