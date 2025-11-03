import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { BehaviorSubject, Observable, of, shareReplay, tap } from 'rxjs';

// Plugin subscription interfaces
export interface IPluginSubscription {
	id: string;
	pluginId: string;
	userId: string;
	subscriptionType: PluginSubscriptionType;
	billingPeriod: PluginBillingPeriod;
	status: PluginSubscriptionStatus;
	startDate: Date;
	endDate?: Date;
	trialEndDate?: Date;
	nextBillingDate?: Date;
	amount: number;
	currency: string;
	features: string[];
	isAutoRenew: boolean;
	paymentMethodId?: string;
	lastPaymentDate?: Date;
	lastPaymentAmount?: number;
	cancelledAt?: Date;
	cancelReason?: string;
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

export interface IPluginSubscriptionPlan {
	id: string;
	pluginId: string;
	type: PluginSubscriptionType;
	name: string;
	description: string;
	price: number;
	currency: string;
	billingPeriod: PluginBillingPeriod;
	features: string[];
	limitations?: Record<string, any>;
	isPopular?: boolean;
	isRecommended?: boolean;
	trialDays?: number;
	setupFee?: number;
	discountPercentage?: number;
	isActive: boolean;
	metadata?: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}

export interface IPluginBilling {
	id: string;
	subscriptionId: string;
	amount: number;
	currency: string;
	status: BillingStatus;
	billingDate: Date;
	paidDate?: Date;
	dueDate: Date;
	invoiceNumber: string;
	paymentMethodId?: string;
	transactionId?: string;
	failureReason?: string;
	retryCount: number;
	metadata?: Record<string, any>;
}

export interface IPluginPayment {
	id: string;
	subscriptionId: string;
	billingId?: string;
	amount: number;
	currency: string;
	status: PaymentStatus;
	paymentMethod: PaymentMethod;
	transactionId: string;
	gatewayResponse?: Record<string, any>;
	processedAt: Date;
	refundedAt?: Date;
	refundAmount?: number;
	refundReason?: string;
}

export enum PluginSubscriptionType {
	FREE = 'free',
	TRIAL = 'trial',
	BASIC = 'basic',
	PREMIUM = 'premium',
	ENTERPRISE = 'enterprise',
	CUSTOM = 'custom'
}

export enum PluginBillingPeriod {
	DAILY = 'daily',
	WEEKLY = 'weekly',
	MONTHLY = 'monthly',
	QUARTERLY = 'quarterly',
	YEARLY = 'yearly',
	ONE_TIME = 'one-time'
}

export enum PluginSubscriptionStatus {
	ACTIVE = 'active',
	CANCELLED = 'cancelled',
	EXPIRED = 'expired',
	TRIAL = 'trial',
	PAST_DUE = 'past_due',
	SUSPENDED = 'suspended',
	PENDING = 'pending'
}

export enum BillingStatus {
	PENDING = 'pending',
	PAID = 'paid',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded'
}

export enum PaymentStatus {
	PENDING = 'pending',
	COMPLETED = 'completed',
	FAILED = 'failed',
	CANCELLED = 'cancelled',
	REFUNDED = 'refunded'
}

export enum PaymentMethod {
	CREDIT_CARD = 'credit_card',
	DEBIT_CARD = 'debit_card',
	PAYPAL = 'paypal',
	STRIPE = 'stripe',
	BANK_TRANSFER = 'bank_transfer',
	CRYPTOCURRENCY = 'cryptocurrency'
}

// Input interfaces
export interface IPluginSubscriptionCreateInput {
	pluginId: string;
	planId?: string;
	subscriptionType: PluginSubscriptionType;
	billingPeriod: PluginBillingPeriod;
	paymentMethodId?: string;
	promoCode?: string;
	metadata?: Record<string, any>;
}

export interface IPluginSubscriptionUpdateInput {
	subscriptionType?: PluginSubscriptionType;
	billingPeriod?: PluginBillingPeriod;
	isAutoRenew?: boolean;
	paymentMethodId?: string;
	metadata?: Record<string, any>;
}

export interface IPluginPlanCreateInput {
	id?: string;
	pluginId: string;
	type: PluginSubscriptionType;
	name: string;
	description: string;
	price: number;
	currency: string;
	billingPeriod: PluginBillingPeriod;
	features: string[];
	limitations?: Record<string, any>;
	trialDays?: number;
	setupFee?: number;
	discountPercentage?: number;
	isPopular?: boolean;
	isRecommended?: boolean;
	metadata?: Record<string, any>;
}

@Injectable({
	providedIn: 'root'
})
export class PluginSubscriptionService {
	// Updated endpoints to match backend controller structure
	private readonly subscriptionsEndPoint = `${API_PREFIX}/plugins`;
	private readonly plansEndPoint = `${API_PREFIX}/plugin-plans`;
	private readonly billingEndPoint = `${API_PREFIX}/plugin-billing`;
	private readonly paymentsEndPoint = `${API_PREFIX}/plugin-payments`;

	private readonly subscriptionsCache$ = new BehaviorSubject<IPluginSubscription[]>([]);
	private readonly plansCache$ = new BehaviorSubject<IPluginSubscriptionPlan[]>([]);

	constructor(private readonly http: HttpClient) {}

	// Subscription CRUD Operations
	public getAllSubscriptions<T>(params = {} as T): Observable<IPagination<IPluginSubscription>> {
		// Get all subscriptions across all plugins - this would be implemented if needed
		// For now, return empty pagination
		return of({
			items: [],
			total: 0
		} as IPagination<IPluginSubscription>);
	}

	public getSubscription(pluginId: string, subscriptionId: string): Observable<IPluginSubscription> {
		return this.http.get<IPluginSubscription>(
			`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${subscriptionId}`
		);
	}

	public getUserSubscriptions(userId?: string): Observable<IPluginSubscription[]> {
		const endpoint = userId
			? `${this.subscriptionsEndPoint}/subscriptions/user/${userId}`
			: `${this.subscriptionsEndPoint}/subscriptions/me`;
		return this.http.get<IPluginSubscription[]>(endpoint);
	}

	public getPluginSubscriptions(pluginId: string): Observable<IPluginSubscription[]> {
		return this.http.get<IPluginSubscription[]>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions`);
	}

	public createSubscription(subscription: IPluginSubscriptionCreateInput): Observable<IPluginSubscription> {
		return this.http
			.post<IPluginSubscription>(
				`${this.subscriptionsEndPoint}/${subscription.pluginId}/subscriptions`,
				subscription
			)
			.pipe(
				tap((newSubscription) => {
					const current = this.subscriptionsCache$.value;
					this.subscriptionsCache$.next([newSubscription, ...current]);
				})
			);
	}

	public updateSubscription(
		pluginId: string,
		id: string,
		subscription: IPluginSubscriptionUpdateInput
	): Observable<IPluginSubscription> {
		return this.http
			.put<IPluginSubscription>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}`, subscription)
			.pipe(
				tap((updatedSubscription) => {
					const current = this.subscriptionsCache$.value;
					const updated = current.map((s) => (s.id === id ? updatedSubscription : s));
					this.subscriptionsCache$.next(updated);
				})
			);
	}

	public cancelSubscription(pluginId: string, id: string, reason?: string): Observable<IPluginSubscription> {
		return this.http
			.patch<IPluginSubscription>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}`, {
				status: 'cancelled',
				reason
			})
			.pipe(
				tap((cancelledSubscription) => {
					const current = this.subscriptionsCache$.value;
					const updated = current.map((s) => (s.id === id ? cancelledSubscription : s));
					this.subscriptionsCache$.next(updated);
				})
			);
	}

	public renewSubscription(pluginId: string, id: string): Observable<IPluginSubscription> {
		return this.http.patch<IPluginSubscription>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}`, {
			status: 'renewed'
		});
	}

	public upgradeSubscription(pluginId: string, id: string, newPlanId: string): Observable<IPluginSubscription> {
		return this.http.post<IPluginSubscription>(
			`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}/upgrade`,
			{ planId: newPlanId }
		);
	}

	public downgradeSubscription(pluginId: string, id: string, newPlanId: string): Observable<IPluginSubscription> {
		return this.http.post<IPluginSubscription>(
			`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}/downgrade`,
			{ planId: newPlanId }
		);
	}

	public extendTrial(pluginId: string, id: string, days: number): Observable<IPluginSubscription> {
		return this.http.post<IPluginSubscription>(
			`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}/extend-trial`,
			{ days }
		);
	}

	// Subscription Plans
	public getAllPlans<T>(params = {} as T): Observable<IPagination<IPluginSubscriptionPlan>> {
		return this.http
			.get<IPagination<IPluginSubscriptionPlan>>(this.plansEndPoint, {
				params: toParams(params)
			})
			.pipe(
				tap((response) => {
					this.plansCache$.next(response.items);
				}),
				shareReplay(1)
			);
	}

	public getPlan(id: string): Observable<IPluginSubscriptionPlan> {
		return this.http.get<IPluginSubscriptionPlan>(`${this.plansEndPoint}/${id}`);
	}

	public getPluginPlans(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.http.get<IPluginSubscriptionPlan[]>(`${this.plansEndPoint}/plugin/${pluginId}`);
	}

	public createPlan(plan: IPluginPlanCreateInput): Observable<IPluginSubscriptionPlan> {
		return this.http.post<IPluginSubscriptionPlan>(this.plansEndPoint, plan).pipe(
			tap((newPlan) => {
				const current = this.plansCache$.value;
				this.plansCache$.next([newPlan, ...current]);
			})
		);
	}

	public updatePlan(id: string, plan: Partial<IPluginPlanCreateInput>): Observable<IPluginSubscriptionPlan> {
		return this.http.put<IPluginSubscriptionPlan>(`${this.plansEndPoint}/${id}`, plan).pipe(
			tap((updatedPlan) => {
				const current = this.plansCache$.value;
				const updated = current.map((p) => (p.id === id ? updatedPlan : p));
				this.plansCache$.next(updated);
			})
		);
	}

	public deletePlan(id: string): Observable<void> {
		return this.http.delete<void>(`${this.plansEndPoint}/${id}`).pipe(
			tap(() => {
				const current = this.plansCache$.value;
				const filtered = current.filter((p) => p.id !== id);
				this.plansCache$.next(filtered);
			})
		);
	}

	// Billing Operations
	public getBillingHistory(subscriptionId: string): Observable<IPluginBilling[]> {
		return this.http.get<IPluginBilling[]>(`${this.billingEndPoint}/subscription/${subscriptionId}`);
	}

	public getBillingRecord(id: string): Observable<IPluginBilling> {
		return this.http.get<IPluginBilling>(`${this.billingEndPoint}/${id}`);
	}

	public retryBilling(id: string): Observable<IPluginBilling> {
		return this.http.post<IPluginBilling>(`${this.billingEndPoint}/${id}/retry`, {});
	}

	public downloadInvoice(billingId: string): Observable<Blob> {
		return this.http.get(`${this.billingEndPoint}/${billingId}/invoice`, {
			responseType: 'blob'
		});
	}

	// Payment Operations
	public getPaymentHistory(subscriptionId: string): Observable<IPluginPayment[]> {
		return this.http.get<IPluginPayment[]>(`${this.paymentsEndPoint}/subscription/${subscriptionId}`);
	}

	public getPayment(id: string): Observable<IPluginPayment> {
		return this.http.get<IPluginPayment>(`${this.paymentsEndPoint}/${id}`);
	}

	public processPayment(subscriptionId: string, paymentMethodId: string): Observable<IPluginPayment> {
		return this.http.post<IPluginPayment>(`${this.paymentsEndPoint}/process`, {
			subscriptionId,
			paymentMethodId
		});
	}

	public refundPayment(id: string, amount?: number, reason?: string): Observable<IPluginPayment> {
		return this.http.post<IPluginPayment>(`${this.paymentsEndPoint}/${id}/refund`, {
			amount,
			reason
		});
	}

	// Analytics and Reports
	public getSubscriptionAnalytics(pluginId?: string): Observable<{
		totalSubscriptions: number;
		activeSubscriptions: number;
		trialSubscriptions: number;
		revenue: number;
		churnRate: number;
		averageRevenuePerUser: number;
		subscriptionsByType: Record<PluginSubscriptionType, number>;
		revenueByPeriod: Array<{ period: string; revenue: number }>;
	}> {
		const params = pluginId ? { pluginId } : {};
		return this.http.get<{
			totalSubscriptions: number;
			activeSubscriptions: number;
			trialSubscriptions: number;
			revenue: number;
			churnRate: number;
			averageRevenuePerUser: number;
			subscriptionsByType: Record<PluginSubscriptionType, number>;
			revenueByPeriod: Array<{ period: string; revenue: number }>;
		}>(`${this.subscriptionsEndPoint}/analytics`, { params: toParams(params) });
	}

	public getSubscriptionMetrics(
		pluginId: string,
		subscriptionId: string
	): Observable<{
		usage: Record<string, number>;
		limits: Record<string, number>;
		remainingTrialDays?: number;
		nextBillingAmount: number;
		nextBillingDate: Date;
	}> {
		return this.http.get<{
			usage: Record<string, number>;
			limits: Record<string, number>;
			remainingTrialDays?: number;
			nextBillingAmount: number;
			nextBillingDate: Date;
		}>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${subscriptionId}/metrics`);
	}

	// Utility Methods
	public validatePromoCode(
		code: string,
		pluginId?: string
	): Observable<{
		valid: boolean;
		discount: number;
		discountType: 'percentage' | 'fixed';
		expiresAt?: Date;
	}> {
		return this.http.post<{
			valid: boolean;
			discount: number;
			discountType: 'percentage' | 'fixed';
			expiresAt?: Date;
		}>(`${this.subscriptionsEndPoint}/promo-code/validate`, { code, pluginId });
	}

	public getSubscriptionPreview(
		planId: string,
		promoCode?: string
	): Observable<{
		baseAmount: number;
		discount: number;
		totalAmount: number;
		currency: string;
		billingPeriod: PluginBillingPeriod;
		trialDays?: number;
		nextBillingDate: Date;
	}> {
		return this.http.post<{
			baseAmount: number;
			discount: number;
			totalAmount: number;
			currency: string;
			billingPeriod: PluginBillingPeriod;
			trialDays?: number;
			nextBillingDate: Date;
		}>(`${this.subscriptionsEndPoint}/preview`, { planId, promoCode });
	}

	// Cache Management
	public getSubscriptionsFromCache(): Observable<IPluginSubscription[]> {
		return this.subscriptionsCache$.asObservable();
	}

	public getPlansFromCache(): Observable<IPluginSubscriptionPlan[]> {
		return this.plansCache$.asObservable();
	}

	public clearCache(): void {
		this.subscriptionsCache$.next([]);
		this.plansCache$.next([]);
	}

	// Helper Methods
	public isSubscriptionActive(subscription: IPluginSubscription): boolean {
		return (
			subscription.status === PluginSubscriptionStatus.ACTIVE ||
			subscription.status === PluginSubscriptionStatus.TRIAL
		);
	}

	public getSubscriptionStatusBadge(status: PluginSubscriptionStatus): {
		text: string;
		color: string;
		icon: string;
	} {
		const statusMap = {
			[PluginSubscriptionStatus.ACTIVE]: {
				text: 'Active',
				color: 'success',
				icon: 'checkmark-circle-outline'
			},
			[PluginSubscriptionStatus.TRIAL]: {
				text: 'Trial',
				color: 'info',
				icon: 'clock-outline'
			},
			[PluginSubscriptionStatus.CANCELLED]: {
				text: 'Cancelled',
				color: 'warning',
				icon: 'close-circle-outline'
			},
			[PluginSubscriptionStatus.EXPIRED]: {
				text: 'Expired',
				color: 'danger',
				icon: 'alert-circle-outline'
			},
			[PluginSubscriptionStatus.PAST_DUE]: {
				text: 'Past Due',
				color: 'danger',
				icon: 'alert-triangle-outline'
			},
			[PluginSubscriptionStatus.SUSPENDED]: {
				text: 'Suspended',
				color: 'warning',
				icon: 'pause-circle-outline'
			},
			[PluginSubscriptionStatus.PENDING]: {
				text: 'Pending',
				color: 'basic',
				icon: 'hourglass-outline'
			}
		};

		return statusMap[status] || statusMap[PluginSubscriptionStatus.PENDING];
	}

	public formatSubscriptionType(type: PluginSubscriptionType): string {
		const typeMap = {
			[PluginSubscriptionType.FREE]: 'Free',
			[PluginSubscriptionType.TRIAL]: 'Trial',
			[PluginSubscriptionType.BASIC]: 'Basic',
			[PluginSubscriptionType.PREMIUM]: 'Premium',
			[PluginSubscriptionType.ENTERPRISE]: 'Enterprise',
			[PluginSubscriptionType.CUSTOM]: 'Custom'
		};

		return typeMap[type] || type;
	}

	public formatBillingPeriod(period: PluginBillingPeriod): string {
		const periodMap = {
			[PluginBillingPeriod.DAILY]: 'Daily',
			[PluginBillingPeriod.WEEKLY]: 'Weekly',
			[PluginBillingPeriod.MONTHLY]: 'Monthly',
			[PluginBillingPeriod.QUARTERLY]: 'Quarterly',
			[PluginBillingPeriod.YEARLY]: 'Yearly',
			[PluginBillingPeriod.ONE_TIME]: 'One-time'
		};

		return periodMap[period] || period;
	}

	public calculateProrationAmount(
		currentPlan: IPluginSubscriptionPlan,
		newPlan: IPluginSubscriptionPlan,
		daysRemaining: number
	): number {
		const currentDailyRate = currentPlan.price / this.getBillingPeriodDays(currentPlan.billingPeriod);
		const newDailyRate = newPlan.price / this.getBillingPeriodDays(newPlan.billingPeriod);

		return (newDailyRate - currentDailyRate) * daysRemaining;
	}

	private getBillingPeriodDays(period: PluginBillingPeriod): number {
		const periodDays = {
			[PluginBillingPeriod.DAILY]: 1,
			[PluginBillingPeriod.WEEKLY]: 7,
			[PluginBillingPeriod.MONTHLY]: 30,
			[PluginBillingPeriod.QUARTERLY]: 90,
			[PluginBillingPeriod.YEARLY]: 365,
			[PluginBillingPeriod.ONE_TIME]: 365
		};

		return periodDays[period] || 30;
	}
}
