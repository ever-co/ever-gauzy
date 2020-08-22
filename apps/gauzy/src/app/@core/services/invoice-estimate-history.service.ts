import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	InvoiceEstimateHistory,
	InvoiceEstimateHistoryFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class InvoiceEstimateHistoryService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: InvoiceEstimateHistoryFindInput
	): Promise<{ items: InvoiceEstimateHistory[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: InvoiceEstimateHistory[] }>(
				'/api/invoice-estimate-history',
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	add(
		invoiceEstimateHistory: InvoiceEstimateHistory
	): Promise<InvoiceEstimateHistory> {
		return this.http
			.post<InvoiceEstimateHistory>(
				'/api/invoice-estimate-history',
				invoiceEstimateHistory
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/invoice-estimate-history/${id}`)
			.pipe(first())
			.toPromise();
	}
}
