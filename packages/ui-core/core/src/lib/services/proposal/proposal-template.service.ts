import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IEmployeeProposalTemplate,
	IEmployeeProposalTemplateCreateInput,
	IEmployeeProposalTemplateMakeDefaultInput,
	IEmployeeProposalTemplateUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ProposalTemplateService {
	API_URL = `${API_PREFIX}/employee-proposal-template`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Fetches all employee proposal templates based on the given request parameters.
	 *
	 * @param request - An optional object containing query parameters to filter and sort the results.
	 * @returns A promise that resolves with a pagination object containing the list of employee proposal templates.
	 */
	getAll(request: any = {}) {
		return firstValueFrom(
			this.http.get<IPagination<IEmployeeProposalTemplate>>(this.API_URL, {
				params: toParams(request)
			})
		);
	}

	/**
	 * Creates a new employee proposal template with the provided input data.
	 *
	 * @param input - An object containing the data for the new employee proposal template.
	 * @returns A promise that resolves with the created employee proposal template.
	 */
	create(input: IEmployeeProposalTemplateCreateInput) {
		return firstValueFrom(this.http.post<IEmployeeProposalTemplate>(this.API_URL, input));
	}

	/**
	 * Updates an existing employee proposal template with the given ID using the provided data.
	 *
	 * @param id - The ID of the employee proposal template to update.
	 * @param request - An object containing the updated data for the employee proposal template.
	 * @returns A promise that resolves with the updated employee proposal template.
	 */
	update(id: ID, request: IEmployeeProposalTemplateUpdateInput) {
		return firstValueFrom(this.http.put<IEmployeeProposalTemplate>(`${this.API_URL}/${id}`, request));
	}

	/**
	 * Sets the specified employee proposal template as the default template.
	 *
	 * @param id - The ID of the employee proposal template to set as default.
	 * @param input - An object containing any additional data required for making the template default.
	 * @returns A promise that resolves with the updated employee proposal template.
	 */
	makeDefault(id: ID, input: IEmployeeProposalTemplateMakeDefaultInput) {
		return firstValueFrom(this.http.patch<IEmployeeProposalTemplate>(`${this.API_URL}/${id}/make-default`, input));
	}

	/**
	 * Deletes the employee proposal template with the specified ID.
	 *
	 * @param id - The ID of the employee proposal template to delete.
	 * @returns A promise that resolves when the employee proposal template has been deleted.
	 */
	delete(id: ID) {
		return firstValueFrom(this.http.delete(`${this.API_URL}/${id}`));
	}
}
