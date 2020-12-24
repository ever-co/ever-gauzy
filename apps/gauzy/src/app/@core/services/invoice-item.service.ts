import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoiceItem,
	IInvoiceItemCreateInput,
	IInvoiceItemFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';
@Injectable()
export class InvoiceItemService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IInvoiceItemFindInput
	): Promise<{ items: IInvoiceItem[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IInvoiceItem[] }>('/api/invoice-item', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(invoiceItem: IInvoiceItem): Promise<IInvoiceItem> {
		return this.http
			.post<IInvoiceItem>('/api/invoice-item', invoiceItem)
			.pipe(first())
			.toPromise();
	}

	update(id: string, invoiceItem: IInvoiceItem): Promise<IInvoiceItem> {
		return this.http
			.put<IInvoiceItem>(`/api/invoice-item/${id}`, invoiceItem)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/invoice-item/${id}`)
			.pipe(first())
			.toPromise();
	}

	createBulk(
		invoiceId: string,
		invoiceItem: IInvoiceItemCreateInput[]
	): Promise<IInvoiceItem[]> {
		return this.http
			.post<IInvoiceItem[]>(
				`/api/invoice-item/createBulk/${invoiceId}`,
				invoiceItem
			)
			.pipe(first())
			.toPromise();
	}
}
