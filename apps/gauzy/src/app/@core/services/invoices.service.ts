import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Invoice, InvoiceFindInput, InvoiceUpdateInput } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class InvoicesService {
	private source = new BehaviorSubject(false);
	currentData = this.source.asObservable();

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: InvoiceFindInput
	): Promise<{ items: Invoice[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: Invoice[] }>('/api/invoices', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getHighestInvoiceNumber(): Promise<Invoice> {
		return this.http
			.get<Invoice>('/api/invoices/highest')
			.pipe(first())
			.toPromise();
	}

	getById(id: string, relations?: string[]) {
		const data = JSON.stringify({ relations });
		return this.http
			.get<Invoice>(`/api/invoices/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(invoice: Invoice): Promise<Invoice> {
		return this.http
			.post<Invoice>('/api/invoices', invoice)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: InvoiceUpdateInput): Promise<Invoice> {
		return this.http
			.put<Invoice>(`/api/invoices/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updateWithoutAuth(
		id: string,
		updateInput: InvoiceUpdateInput
	): Promise<Invoice> {
		return this.http
			.put<Invoice>(`/api/invoices/estimate/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	edit(invoice: Invoice): Promise<Invoice> {
		return this.http
			.put<Invoice>(`/api/invoices/${invoice.id}`, invoice)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/invoices/${id}`)
			.pipe(first())
			.toPromise();
	}

	sendEmail(
		email: string,
		base64: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean
	): Promise<any> {
		return this.http
			.put<any>(`/api/invoices/email/${email}`, {
				params: {
					isEstimate,
					base64,
					invoiceNumber,
					invoiceId
				}
			})
			.pipe(first())
			.toPromise();
	}

	changeValue(message: boolean) {
		this.source.next(message);
	}
}
