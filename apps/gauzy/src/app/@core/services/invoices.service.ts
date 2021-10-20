import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IInvoice,
	IInvoiceCreateInput,
	IInvoiceFindInput,
	IInvoiceUpdateInput
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
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

		return firstValueFrom(
			this.http
			.get<{ items: IInvoice[] }>(`${API_PREFIX}/invoices`, {
				params: { data }
			})
		);
	}

	getHighestInvoiceNumber(tenantId: string): Promise<IInvoice> {
		return firstValueFrom(
			this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/highest`, {
				params: toParams({ tenantId })
			})
		);
	}

	getById(id: string, relations?: string[], findInput?: IInvoiceFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/${id}`, {
				params: { data }
			})
		);
	}

	getWithoutAuth(id: string, token: string, relations?: string[]) {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http
			.get<IInvoice>(`${API_PREFIX}/invoices/public/${id}/${token}`, {
				params: { data }
			})
		);
	}

	add(invoice: IInvoiceCreateInput): Promise<IInvoice> {
		return firstValueFrom(
			this.http
			.post<IInvoice>(`${API_PREFIX}/invoices`, invoice)
		);
	}

	update(id: string, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(
			this.http
			.put<IInvoice>(`${API_PREFIX}/invoices/${id}`, updateInput)
		);
	}

	updateWithoutAuth(
		id: string,
		updateInput: IInvoiceUpdateInput
	): Promise<IInvoice> {
		return firstValueFrom(
			this.http
			.put<IInvoice>(`${API_PREFIX}/invoices/estimate/${id}`, updateInput)
		);
	}

	edit(invoice: IInvoice): Promise<IInvoice> {
		return firstValueFrom(
			this.http
			.put<IInvoice>(`${API_PREFIX}/invoices/${invoice.id}`, invoice)
		);
	}

	generateLink(id: string, isEstimate: boolean): Promise<any> {
		return firstValueFrom(
			this.http
			.put<any>(`${API_PREFIX}/invoices/generate/${id}`, {
				params: {
					isEstimate
				}
			})
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/invoices/${id}`)
		);
	}

	sendEmail(
		email: string,
		invoiceNumber: number,
		invoiceId: string,
		isEstimate: boolean,
		organizationId: string,
		tenantId: string
	): Promise<any> {
		return firstValueFrom(
			this.http
			.put<any>(`${API_PREFIX}/invoices/email/${email}`, {
				params: {
					isEstimate,
					invoiceNumber,
					invoiceId,
					organizationId,
					tenantId
				}
			})
		);
	}

	changeValue(message: boolean) {
		this.source.next(message);
	}

	downloadInvoicePdf(invoiceId: string) {
		return this.http.get(`${API_PREFIX}/invoices/download/${invoiceId}`, {
			responseType: 'blob'
		});
	}

	downloadInvoicePaymentPdf(invoiceId: string) {
		return this.http.get(
			`${API_PREFIX}/invoices/payment/download/${invoiceId}`,
			{
				responseType: 'blob'
			}
		);
	}
}
