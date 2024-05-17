import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IGetPaymentInput,
	IInvoice,
	IPagination,
	IPayment,
	IPaymentFindInput,
	IPaymentReportChartData,
	IPaymentReportData,
	IPaymentUpdateInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '../constants/app.constants';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class PaymentService {
	constructor(private http: HttpClient) {}

	getAll(relations: string[] = [], where?: IPaymentFindInput): Promise<IPagination<IPayment>> {
		return firstValueFrom(
			this.http.get<IPagination<IPayment>>(`${API_PREFIX}/payments`, {
				params: toParams({ relations, where })
			})
		);
	}

	add(payment: IPayment): Promise<IPayment> {
		return firstValueFrom(this.http.post<IPayment>(`${API_PREFIX}/payments`, payment));
	}

	update(id: string, updateInput: IPaymentUpdateInput): Promise<IPayment> {
		return firstValueFrom(this.http.put<IPayment>(`${API_PREFIX}/payments/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/payments/${id}`));
	}

	/**
	 * Asynchronously retrieves payment report data based on the provided request parameters.
	 *
	 * @param request - Optional parameters for customizing the request (IGetPaymentInput).
	 * @returns A Promise that resolves to the payment report data.
	 */
	async getPaymentsReport(request?: IGetPaymentInput): Promise<IPaymentReportData[]> {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);

		// Make an HTTP GET request to the payment report data endpoint
		return await firstValueFrom(this.http.get<IPaymentReportData[]>(`${API_PREFIX}/payments/report`, { params }));
	}

	/**
	 * retrieves payment report chart data based on the provided request parameters.
	 *
	 * @param request - Optional parameters for customizing the request (IGetPaymentInput).
	 * @returns A Promise that resolves to the payment report chart data.
	 */
	async getPaymentsReportCharts(request?: IGetPaymentInput): Promise<IPaymentReportChartData[]> {
		// Convert the request parameters to URL query parameters
		const params = toParams(request);

		// Make an HTTP GET request to the payment report chart data endpoint
		return await firstValueFrom(
			this.http.get<IPaymentReportChartData[]>(`${API_PREFIX}/payments/report/charts`, { params })
		);
	}

	sendReceipt(payment: IPayment, invoice: IInvoice): Promise<any> {
		return firstValueFrom(
			this.http.post<any>(`${API_PREFIX}/payments/receipt`, {
				params: {
					payment,
					invoice
				}
			})
		);
	}
}
