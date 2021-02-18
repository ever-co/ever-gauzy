import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoice,
	IInvoiceCreateInput,
	IInvoiceFindInput,
	IInvoiceUpdateInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

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
			.get<{ items: IInvoice[] }>(`${API_PREFIX}/invoices`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getHighestInvoiceNumber(tenantId: string): Promise<IInvoice> {
		return this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/highest`, {
				params: toParams({ tenantId })
			})
			.pipe(first())
			.toPromise();
	}

	getById(id: string, relations?: string[], findInput?: IInvoiceFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getWithoutAuth(id: string, token: string, relations?: string[]) {
		const data = JSON.stringify({ relations });
		return this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/public/${id}/${token}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(invoice: IInvoiceCreateInput): Promise<IInvoice> {
		return this.http
			.post<IInvoice>(`${API_PREFIX}/invoices`, invoice)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return this.http
			.put<IInvoice>(`${API_PREFIX}/invoices/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updateWithoutAuth(
		id: string,
		updateInput: IInvoiceUpdateInput
	): Promise<IInvoice> {
		return this.http
			.put<IInvoice>(`${API_PREFIX}/invoices/estimate/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	edit(invoice: IInvoice): Promise<IInvoice> {
		return this.http
			.put<IInvoice>(`${API_PREFIX}/invoices/${invoice.id}`, invoice)
			.pipe(first())
			.toPromise();
	}

	generateLink(id: string, isEstimate: boolean): Promise<any> {
		return this.http
			.put<any>(`${API_PREFIX}/invoices/generate/${id}`, {
				params: {
					isEstimate
				}
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/invoices/${id}`)
			.pipe(first())
			.toPromise();
	}

	sendEmail(
		email: string,
		base64: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		organizationId: string,
		tenantId: string
	): Promise<any> {
		return this.http
			.put<any>(`${API_PREFIX}/invoices/email/${email}`, {
				params: {
					isEstimate,
					base64,
					invoiceNumber,
					invoiceId,
					organizationId,
					tenantId
				}
			})
			.pipe(first())
			.toPromise();
	}

	changeValue(message: boolean) {
		this.source.next(message);
	}

	downloadInvoicePdf(invoiceId: string) {
		return this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/download/${invoiceId}`)
			.pipe(first())
			.toPromise();
	}
}
