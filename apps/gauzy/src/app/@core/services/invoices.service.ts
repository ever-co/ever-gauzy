import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Invoice } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class InvoicesService {
	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: Invoice[] }> {
		return this.http
			.get<{ items: Invoice[] }>('/api/invoices')
			.pipe(first())
			.toPromise();
	}

	save(invoice: Invoice): Promise<Invoice> {
		if (!invoice.id) {
			return this.http
				.post<Invoice>('/api/invoices', invoice)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<Invoice>(`/api/invoices/${invoice.id}`, invoice)
				.pipe(first())
				.toPromise();
		}
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/invoices/${id}`)
			.pipe(first())
			.toPromise();
	}
}
