import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IGetPaymentInput,
	IInvoice,
	IPayment,
	IPaymentFindInput,
	IPaymentReportChartData,
	IPaymentReportData,
	IPaymentUpdateInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class PaymentService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IPaymentFindInput
	): Promise<{ items: IPayment[] }> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http
			.get<{ items: IPayment[] }>(`${API_PREFIX}/payments`, {
				params: { data }
			})
		);
	}

	add(payment: IPayment): Promise<IPayment> {
		return firstValueFrom(
			this.http
			.post<IPayment>(`${API_PREFIX}/payments`, payment)
		);
	}

	update(id: string, updateInput: IPaymentUpdateInput): Promise<IPayment> {
		return firstValueFrom(
			this.http
			.put<IPayment>(`${API_PREFIX}/payments/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/payments/${id}`)
		);
	}

	getReportData(request: IGetPaymentInput) {
		return firstValueFrom(
			this.http
			.get<IPaymentReportData[]>(`${API_PREFIX}/payments/report`, {
				params: toParams(request)
			})
		);
	}
	getReportChartData(request: IGetPaymentInput) {
		return firstValueFrom(
			this.http
			.get<IPaymentReportChartData[]>(
				`${API_PREFIX}/payments/report/chart-data`,
				{
					params: toParams(request)
				}
			)
		);
	}

	sendReceipt(payment: IPayment, invoice: IInvoice): Promise<any> {
		return firstValueFrom(
			this.http
			.post<any>(`${API_PREFIX}/payments/receipt`, {
				params: {
					payment,
					invoice
				}
			})
		);
	}
}
