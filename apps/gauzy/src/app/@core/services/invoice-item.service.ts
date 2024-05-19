import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IInvoiceItem, IInvoiceItemCreateInput, IInvoiceItemFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
@Injectable()
export class InvoiceItemService {
	constructor(private http: HttpClient) {}

	getAll(relations?: string[], findInput?: IInvoiceItemFindInput): Promise<{ items: IInvoiceItem[] }> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http.get<{ items: IInvoiceItem[] }>(`${API_PREFIX}/invoice-item`, {
				params: { data }
			})
		);
	}

	add(invoiceItem: IInvoiceItem): Promise<IInvoiceItem> {
		return firstValueFrom(this.http.post<IInvoiceItem>(`${API_PREFIX}/invoice-item`, invoiceItem));
	}

	update(id: string, invoiceItem: IInvoiceItem): Promise<IInvoiceItem> {
		return firstValueFrom(this.http.put<IInvoiceItem>(`${API_PREFIX}/invoice-item/${id}`, invoiceItem));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/invoice-item/${id}`));
	}

	createBulk(invoiceId: string, invoiceItem: IInvoiceItemCreateInput[]): Promise<IInvoiceItem[]> {
		return firstValueFrom(
			this.http.post<IInvoiceItem[]>(`${API_PREFIX}/invoice-item/bulk/${invoiceId}`, invoiceItem)
		);
	}
}
