import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IGetPaymentInput,
	IPayment,
	IPaymentFindInput,
	IPaymentReportChartData,
	IPaymentReportData,
	IPaymentUpdateInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { toParams } from '@gauzy/common-angular';

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
		return this.http
			.get<{ items: IPayment[] }>('/api/payments', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(payment: IPayment): Promise<IPayment> {
		return this.http
			.post<IPayment>('/api/payments', payment)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IPaymentUpdateInput): Promise<IPayment> {
		return this.http
			.put<IPayment>(`/api/payments/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/payments/${id}`)
			.pipe(first())
			.toPromise();
	}

	getReportData(request: IGetPaymentInput) {
		return this.http
			.get<IPaymentReportData[]>('/api/payments/report', {
				params: toParams(request)
			})
			.pipe(first())
			.toPromise();
	}
	getReportChartData(request: IGetPaymentInput) {
		return this.http
			.get<IPaymentReportChartData[]>('/api/payments/report/chart-data', {
				params: toParams(request)
			})
			.pipe(first())
			.toPromise();
	}
}
