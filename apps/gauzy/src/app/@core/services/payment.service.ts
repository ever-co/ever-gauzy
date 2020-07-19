import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Payment, PaymentFindInput, PaymentUpdateInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class PaymentService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: PaymentFindInput
	): Promise<{ items: Payment[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: Payment[] }>('/api/payments', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	add(payment: Payment): Promise<Payment> {
		return this.http
			.post<Payment>('/api/payments', payment)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: PaymentUpdateInput): Promise<Payment> {
		return this.http
			.put<Payment>(`/api/payments/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/payments/${id}`)
			.pipe(first())
			.toPromise();
	}
}
