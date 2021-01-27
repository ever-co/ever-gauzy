import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoiceEstimateHistory,
	IInvoiceEstimateHistoryFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable()
export class InvoiceEstimateHistoryService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IInvoiceEstimateHistoryFindInput
	): Promise<{ items: IInvoiceEstimateHistory[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IInvoiceEstimateHistory[] }>(
				'/api/invoice-estimate-history',
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	add(
		invoiceEstimateHistory: IInvoiceEstimateHistory
	): Promise<IInvoiceEstimateHistory> {
		return this.http
			.post<IInvoiceEstimateHistory>(
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
