import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

/**
 * Talks to the platform's own billing endpoints.
 *
 * Nothing here touches Stripe directly — the browser never holds a Stripe key, and every call goes
 * through the API, which resolves the customer from the signed-in tenant rather than from anything
 * the client sends.
 */

export interface IBillingSubscription {
	id: string;
	status: string;
	planName: string;
	lookupKey?: string;
	amount: number;
	currency: string;
	interval: 'month' | 'year' | 'one_time';
	trialEndsAt: string | null;
	renewsAt: string | null;
	cancelAtPeriodEnd: boolean;
}

export interface IBillingPlan {
	lookupKey: string;
	priceId: string;
	productName: string;
	amount: number;
	currency: string;
	interval: 'month' | 'year' | 'one_time';
	tier?: string;
	hosting?: string;
	product?: string;
}

export interface IBillingInvoice {
	id: string;
	number: string | null;
	status: string | null;
	amountPaid: number;
	amountDue: number;
	currency: string;
	createdAt: string;
	hostedInvoiceUrl: string | null;
	invoicePdfUrl: string | null;
}

export interface IBillingPaymentMethod {
	brand: string | null;
	last4: string | null;
	expMonth: number | null;
	expYear: number | null;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
	private readonly endpoint = `${API_PREFIX}/billing`;

	constructor(private readonly http: HttpClient) {}

	/** Whether this deployment does billing at all — self-hosted installs answer `false`. */
	getConfig(): Observable<{ enabled: boolean }> {
		return this.http.get<{ enabled: boolean }>(`${this.endpoint}/config`);
	}

	getSubscription(): Observable<IBillingSubscription | null> {
		return this.http.get<IBillingSubscription | null>(`${this.endpoint}/subscription`);
	}

	getPlans(): Observable<IBillingPlan[]> {
		return this.http.get<IBillingPlan[]>(`${this.endpoint}/plans`);
	}

	changePlan(lookupKey: string): Observable<IBillingSubscription> {
		return this.http.post<IBillingSubscription>(`${this.endpoint}/subscription/change`, { lookupKey });
	}

	cancel(): Observable<IBillingSubscription> {
		return this.http.post<IBillingSubscription>(`${this.endpoint}/subscription/cancel`, {});
	}

	resume(): Observable<IBillingSubscription> {
		return this.http.post<IBillingSubscription>(`${this.endpoint}/subscription/resume`, {});
	}

	getInvoices(): Observable<IBillingInvoice[]> {
		return this.http.get<IBillingInvoice[]>(`${this.endpoint}/invoices`);
	}

	getPaymentMethod(): Observable<IBillingPaymentMethod | null> {
		return this.http.get<IBillingPaymentMethod | null>(`${this.endpoint}/payment-method`);
	}

	/** Creates a Stripe customer portal session and returns the URL to send the user to. */
	openPortal(returnUrl: string): Observable<{ url: string }> {
		return this.http.post<{ url: string }>(`${this.endpoint}/portal`, { returnUrl });
	}
}
