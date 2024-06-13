import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEstimateEmail,
	IInvoice,
	IInvoiceCreateInput,
	IInvoiceFindInput,
	IInvoiceUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

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

	getHighestInvoiceNumber(tenantId: string): Promise<IInvoice> {
		return firstValueFrom(
			this.http.get<IInvoice>(`${API_PREFIX}/invoices/highest`, {
				params: toParams({ tenantId })
			})
		);
	}

	getById(id: string, relations?: string[], findInput?: IInvoiceFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IInvoice>(`${API_PREFIX}/invoices/${id}`, {
				params: { data }
			})
		);
	}

	getPublicInvoice(id: string, token: string, relations: string[] = []) {
		return firstValueFrom(
			this.http.get<IInvoice>(`${API_PREFIX}/public/invoice/${id}/${token}`, {
				params: toParams({ relations })
			})
		);
	}

	add(invoice: IInvoiceCreateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.post<IInvoice>(`${API_PREFIX}/invoices`, invoice));
	}

	update(id: string, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${id}`, updateInput));
	}

	updateEstimate(id: string, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${id}/estimate`, updateInput));
	}

	updateAction(id: string, updateInput: IInvoiceUpdateInput): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${id}/action`, updateInput));
	}

	updateWithoutAuth(
		id: IInvoice['id'],
		token: IEstimateEmail['token'],
		input: IInvoiceUpdateInput
	): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/public/invoice/${id}/${token}`, input));
	}

	edit(invoice: IInvoice): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/${invoice.id}`, invoice));
	}

	generateLink(id: string): Promise<IInvoice> {
		return firstValueFrom(this.http.put<IInvoice>(`${API_PREFIX}/invoices/generate/${id}`, {}));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/invoices/${id}`));
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

	downloadInvoicePdf(invoiceId: string) {
		return this.http.get(`${API_PREFIX}/invoices/download/${invoiceId}`, {
			responseType: 'blob'
		});
	}

	downloadInvoicePaymentPdf(invoiceId: string) {
		return this.http.get(`${API_PREFIX}/invoices/payment/download/${invoiceId}`, {
			responseType: 'blob'
		});
	}
}
