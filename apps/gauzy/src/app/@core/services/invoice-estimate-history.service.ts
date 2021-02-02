import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoiceEstimateHistory,
	IInvoiceEstimateHistoryFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

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
				`${API_PREFIX}/invoice-estimate-history`,
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
				`${API_PREFIX}/invoice-estimate-history`,
				invoiceEstimateHistory
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/invoice-estimate-history/${id}`)
			.pipe(first())
			.toPromise();
	}
}
