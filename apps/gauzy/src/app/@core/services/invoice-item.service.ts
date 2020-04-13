import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { InvoiceItem } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class InvoiceItemService {
	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: InvoiceItem[] }> {
		return this.http
			.get<{ items: InvoiceItem[] }>('/api/invoice-item')
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
