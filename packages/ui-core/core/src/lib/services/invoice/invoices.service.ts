import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ID,
	IEstimateEmail,
	IInvoice,
	IInvoiceCreateInput,
	IInvoiceFindInput,
	IInvoiceUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class InvoicesService {
	private source = new BehaviorSubject(false);
	currentData = this.source.asObservable();

	constructor(private http: HttpClient) {}

	getAll(where: IInvoiceFindInput, relations: string[] = []): Promise<IPagination<IInvoice>> {
		return firstValueFrom(
			this.http.get<IPagination<IInvoice>>(`${API_PREFIX}/invoices`, {
				params: toParams({ where, relations })
			})
		);
	}

	getHighestInvoiceNumber(tenantId: ID): Promise<IInvoice> {
		return firstValueFrom(
			this.http.get<IInvoice>(`${API_PREFIX}/invoices/highest`, {
				params: toParams({ tenantId })
			})
		);
	}

	getById(id: ID, relations?: string[], findInput?: IInvoiceFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IInvoice>(`${API_PREFIX}/invoices/${id}`, {
				params: { data }
			})
		);
	}

	getPublicInvoice(id: ID, token: string, relations: string[] = []) {
		return firstValueFrom(
			this.http.get<IInvoice>(`${API_PREFIX}/public/invoice/${id}/${token}`, {
				params: toParams({ relations })
			})
		);
	}

	add(invoice: IInvoiceCreateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.post<IInvoice>(`${API_PREFIX}/invoices`, invoice));
	}

	update(id: ID, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${id}`, updateInput));
	}

	updateEstimate(id: ID, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${id}/estimate`, updateInput));
	}

	updateAction(id: ID, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${id}/action`, updateInput));
	}

	updateWithoutAuth(id: ID, token: IEstimateEmail['token'], input: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/public/invoice/${id}/${token}`, input));
	}

	edit(invoice: IInvoice): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${invoice.id}`, invoice));
	}

	generateLink(id: ID): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/generate/${id}`, {}));
	}

	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/invoices/${id}`));
	}

	sendEmail(
		email: string,
		invoiceNumber: number,
		invoiceId: ID,
		isEstimate: boolean,
		organizationId: ID,
		tenantId: ID
	): Promise<any> {
		return firstValueFrom(
			this.http.put<any>(`${API_PREFIX}/invoices/email/${email}`, {
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

	downloadInvoicePdf(invoiceId: ID) {
		return this.http.get(`${API_PREFIX}/invoices/download/${invoiceId}`, {
			responseType: 'blob'
		});
	}

	downloadInvoicePaymentPdf(invoiceId: ID) {
		return this.http.get(`${API_PREFIX}/invoices/payment/download/${invoiceId}`, {
			responseType: 'blob'
		});
	}
}
