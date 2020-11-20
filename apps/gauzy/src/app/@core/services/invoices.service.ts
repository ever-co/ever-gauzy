import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoice,
	IInvoiceCreateInput,
	IInvoiceFindInput,
	IInvoiceUpdateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { toParams } from '@gauzy/utils';

@Injectable()
export class InvoicesService {
	private source = new BehaviorSubject(false);
	currentData = this.source.asObservable();

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IInvoiceFindInput
	): Promise<{ items: IInvoice[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IInvoice[] }>('/api/invoices', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getHighestInvoiceNumber(tenantId: string): Promise<IInvoice> {
		return this.http
			.get<IInvoice>('/api/invoices/highest', {
				params: toParams({ tenantId })
			})
			.pipe(first())
			.toPromise();
	}

	getById(id: string, relations?: string[], findInput?: IInvoiceFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<IInvoice>(`/api/invoices/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(invoice: IInvoiceCreateInput): Promise<IInvoice> {
		return this.http
			.post<IInvoice>('/api/invoices', invoice)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return this.http
			.put<IInvoice>(`/api/invoices/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updateWithoutAuth(
		id: string,
		updateInput: IInvoiceUpdateInput
	): Promise<IInvoice> {
		return this.http
			.put<IInvoice>(`/api/invoices/estimate/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	edit(invoice: IInvoice): Promise<IInvoice> {
		return this.http
			.put<IInvoice>(`/api/invoices/${invoice.id}`, invoice)
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
