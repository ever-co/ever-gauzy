import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoiceItem,
	IInvoiceItemCreateInput,
	IInvoiceItemFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';
@Injectable()
export class InvoiceItemService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IInvoiceItemFindInput
	): Promise<{ items: IInvoiceItem[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IInvoiceItem[] }>(`${API_PREFIX}/invoice-item`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(invoiceItem: IInvoiceItem): Promise<IInvoiceItem> {
		return this.http
			.post<IInvoiceItem>(`${API_PREFIX}/invoice-item`, invoiceItem)
			.pipe(first())
			.toPromise();
	}

	update(id: string, invoiceItem: IInvoiceItem): Promise<IInvoiceItem> {
		return this.http
			.put<IInvoiceItem>(`${API_PREFIX}/invoice-item/${id}`, invoiceItem)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/invoice-item/${id}`)
			.pipe(first())
			.toPromise();
	}

	createBulk(
		invoiceId: string,
		invoiceItem: IInvoiceItemCreateInput[]
	): Promise<IInvoiceItem[]> {
		return this.http
			.post<IInvoiceItem[]>(
				`${API_PREFIX}/invoice-item/createBulk/${invoiceId}`,
				invoiceItem
			)
			.pipe(first())
			.toPromise();
	}
}
