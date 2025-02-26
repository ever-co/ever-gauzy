import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IEmailHistory,
	IEmailFindInput,
	IEmailUpdateInput,
	IPagination,
	IResendEmailInput,
	ID
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class EmailService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves a paginated list of email history records.
	 *
	 * @param relations - An array of relation names to include (default is an empty array).
	 * @param where - Optional filtering criteria for the email history records.
	 * @param take - Optional limit on the number of records to retrieve.
	 * @returns A promise that resolves to a paginated list of email history records.
	 */
	getAll(relations: string[] = [], where?: IEmailFindInput, take?: number): Promise<IPagination<IEmailHistory>> {
		const data: Record<string, any> = { relations, where };

		if (take) {
			data.take = take;
		}

		return firstValueFrom(
			this.http.get<IPagination<IEmailHistory>>(`${API_PREFIX}/email`, {
				params: toParams(data)
			})
		);
	}

	/**
	 * Updates an email history record with the given update input.
	 *
	 * @param id - The unique identifier of the email record.
	 * @param body - The payload containing the update details.
	 * @returns A promise that resolves to the updated email history record.
	 */
	update(id: ID, body: IEmailUpdateInput): Promise<IEmailHistory> {
		return firstValueFrom(this.http.put<IEmailHistory>(`${API_PREFIX}/email/${id}`, body));
	}

	/**
	 * Resends an email based on the provided input.
	 *
	 * @param id - The unique identifier of the email record to resend.
	 * @param input - The payload containing resend details.
	 * @returns A promise that resolves to the email history record after resending.
	 */
	resend(id: ID, input: IResendEmailInput): Promise<IEmailHistory> {
		return firstValueFrom(this.http.post<IEmailHistory>(`${API_PREFIX}/email/resend/${id}`, input));
	}
}
