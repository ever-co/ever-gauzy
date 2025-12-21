import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IPagination,
	IPluginBilling,
	IPluginPayment,
	IPluginPlanCreateInput,
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput,
	PluginBillingPeriod,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { map, Observable, of } from 'rxjs';

// Re-export all types for backward compatibility with existing code
export {
	BillingStatus,
	IPlugin,
	IPluginBilling,
	IPluginPayment,
	IPluginPlanCreateInput,
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	IPluginSubscriptionUpdateInput,
	IUser,
	PaymentMethod,
	PaymentStatus,
	PluginBillingPeriod,
	PluginScope,
	PluginSubscriptionStatus,
	PluginSubscriptionType
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class PluginSubscriptionService {
	// Updated endpoints to match backend controller structure
	private readonly subscriptionsEndPoint = `${API_PREFIX}/plugins`;
	private readonly plansEndPoint = `${API_PREFIX}/plugin-plans`;
	private readonly billingEndPoint = `${API_PREFIX}/plugin-billing`;
	private readonly paymentsEndPoint = `${API_PREFIX}/plugin-payments`;
	constructor(private readonly http: HttpClient) {}

	/**
	 * Utility method to normalize API responses that may be arrays or paginated objects
	 * @param response The API response
	 * @returns Array of items, empty array if response format is unexpected
	 */
	private normalizeArrayResponse<T>(response: any): T[] {
		// Handle direct array response
		if (Array.isArray(response)) {
			return response;
		}
		// Handle paginated response with items property
		if (response && Array.isArray(response.items)) {
			return response.items;
		}
		// Handle case where response might be an object with data property
		if (response && Array.isArray(response.data)) {
			return response.data;
		}
		// Fallback to empty array if response format is unexpected
		console.warn('Unexpected response format in API call:', response);
		return [];
	}

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

	public getCurrentSubscription(pluginId: string): Observable<IPluginSubscription> {
		return this.http.get<IPluginSubscription>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/me`);
	}

	public getUserSubscriptions(userId?: string): Observable<IPluginSubscription[]> {
		const endpoint = userId
			? `${this.subscriptionsEndPoint}/subscriptions/user/${userId}`
			: `${this.subscriptionsEndPoint}/subscriptions/me`;
		return this.http
			.get<any>(endpoint)
			.pipe(map((response) => this.normalizeArrayResponse<IPluginSubscription>(response)));
	}

	public getPluginSubscriptions(pluginId: string): Observable<IPluginSubscription[]> {
		return this.http
			.get<any>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions`)
			.pipe(map((response) => this.normalizeArrayResponse<IPluginSubscription>(response)));
	}

	public createSubscription(subscription: IPluginSubscriptionCreateInput): Observable<IPluginSubscription> {
		const payload = {
			pluginId: subscription.pluginId,
			planId: subscription.planId,
			scope: subscription.scope,
			autoRenew: subscription.autoRenew ?? true,
			paymentMethod: subscription.paymentMethod ?? subscription.paymentMethodId,
			promoCode: subscription.promoCode,
			metadata: subscription.metadata
		};

		return this.http.post<IPluginSubscription>(
			`${this.subscriptionsEndPoint}/${subscription.pluginId}/subscriptions`,
			payload
		);
	}

	public updateSubscription(
		pluginId: string,
		id: string,
		subscription: IPluginSubscriptionUpdateInput
	): Observable<IPluginSubscription> {
		return this.http.put<IPluginSubscription>(
			`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}`,
			subscription
		);
	}

	public cancelSubscription(pluginId: string, id: string, reason?: string): Observable<IPluginSubscription> {
		return this.http.patch<IPluginSubscription>(`${this.subscriptionsEndPoint}/${pluginId}/subscriptions/${id}`, {
			status: 'cancelled',
			reason
		});
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
		return this.http.get<IPagination<IPluginSubscriptionPlan>>(this.plansEndPoint, {
			params: toParams(params)
		});
	}

	public getPlan(id: string): Observable<IPluginSubscriptionPlan> {
		return this.http.get<IPluginSubscriptionPlan>(`${this.plansEndPoint}/${id}`);
	}

	public getPluginPlans(pluginId: string): Observable<IPluginSubscriptionPlan[]> {
		return this.http
			.get<any>(`${this.plansEndPoint}/plugin/${pluginId}`)
			.pipe(map((response) => this.normalizeArrayResponse<IPluginSubscriptionPlan>(response)));
	}

	public createPlan(plan: IPluginPlanCreateInput): Observable<IPluginSubscriptionPlan> {
		return this.http.post<IPluginSubscriptionPlan>(this.plansEndPoint, plan);
	}

	public bulkCreatePlans(plans: IPluginPlanCreateInput[]): Observable<IPluginSubscriptionPlan[]> {
		return this.http.post<IPluginSubscriptionPlan[]>(`${this.plansEndPoint}/bulk-create`, { plans });
	}

	public updatePlan(id: string, plan: Partial<IPluginPlanCreateInput>): Observable<IPluginSubscriptionPlan> {
		return this.http.put<IPluginSubscriptionPlan>(`${this.plansEndPoint}/${id}`, plan);
	}

	public deletePlan(id: string): Observable<void> {
		return this.http.delete<void>(`${this.plansEndPoint}/${id}`);
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

	// Helper Methods
	public isSubscriptionActive(subscription: IPluginSubscription): boolean {
		return [
			PluginSubscriptionStatus.ACTIVE,
			PluginSubscriptionStatus.TRIAL,
			PluginSubscriptionStatus.PENDING
		].includes(subscription.status);
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
		const currentPrice = this.parsePriceAsNumber(currentPlan.price);
		const newPrice = this.parsePriceAsNumber(newPlan.price);

		const currentDailyRate = currentPrice / this.getBillingPeriodDays(currentPlan.billingPeriod);
		const newDailyRate = newPrice / this.getBillingPeriodDays(newPlan.billingPeriod);

		return (newDailyRate - currentDailyRate) * daysRemaining;
	}

	private parsePriceAsNumber(price: number | string): number {
		if (typeof price === 'number') {
			return price;
		}
		return parseFloat(price) || 0;
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
