import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { InvoiceItem, InvoiceItemFindInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class InvoiceItemService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: InvoiceItemFindInput
	): Promise<{ items: InvoiceItem[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: InvoiceItem[] }>('/api/invoice-item', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(invoiceItem: InvoiceItem): Promise<InvoiceItem> {
		return this.http
			.post<InvoiceItem>('/api/invoice-item', invoiceItem)
			.pipe(first())
			.toPromise();
	}

	update(id: string, invoiceItem: InvoiceItem): Promise<InvoiceItem> {
		return this.http
			.put<InvoiceItem>(`/api/invoice-item/${id}`, invoiceItem)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/invoice-item/${id}`)
			.pipe(first())
			.toPromise();
	}
}
