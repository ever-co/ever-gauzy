import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IInvoiceEstimateHistory, IInvoiceEstimateHistoryFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class InvoiceEstimateHistoryService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IInvoiceEstimateHistoryFindInput
	): Promise<{ items: IInvoiceEstimateHistory[] }> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http.get<{ items: IInvoiceEstimateHistory[] }>(`${API_PREFIX}/invoice-estimate-history`, {
				params: { data }
			})
		);
	}

	add(invoiceEstimateHistory: IInvoiceEstimateHistory): Promise<IInvoiceEstimateHistory> {
		return firstValueFrom(
			this.http.post<IInvoiceEstimateHistory>(`${API_PREFIX}/invoice-estimate-history`, invoiceEstimateHistory)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/invoice-estimate-history/${id}`));
	}
}
