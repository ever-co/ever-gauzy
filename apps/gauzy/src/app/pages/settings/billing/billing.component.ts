import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-core/core';
import {
	BillingService,
	IBillingInvoice,
	IBillingPaymentMethod,
	IBillingPlan,
	IBillingSubscription
} from './billing.service';

const ZERO_DECIMAL_CURRENCIES = new Set([
	'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
	'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);

const INTERVAL_SUFFIX: Record<string, string> = {
	day: '/day',
	week: '/wk',
	month: '/mo',
	year: '/yr'
};

/**
 * The tenant's billing page.
 *
 * Deliberately covers the things people actually come here to do — see what they are on, switch
 * plan, stop or restart a cancellation, find an invoice — and offers the Stripe customer portal for
 * everything else. Both routes are first-class; the portal is not a substitute for this page.
 *
 * On a deployment with no Stripe key the API reports billing as disabled and this renders a single
 * explanatory card rather than a broken screen.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-billing',
	templateUrl: './billing.component.html',
	styleUrls: ['./billing.component.scss'],
	standalone: false
})
export class BillingComponent extends TranslationBaseComponent implements OnInit {
	/** Null until the config call answers, so the template can hold everything back until then. */
	public billingEnabled: boolean | null = null;
	public loading = true;
	/** Set while a mutation is in flight, to keep the action buttons from being double-fired. */
	public working = false;
	/** True when any part of the last load failed, so the page can say so instead of implying "empty". */
	public loadFailed = false;

	public subscription: IBillingSubscription | null = null;
	public plans: IBillingPlan[] = [];
	public invoices: IBillingInvoice[] = [];
	public paymentMethod: IBillingPaymentMethod | null = null;

	constructor(
		private readonly billingService: BillingService,
		private readonly toastrService: ToastrService,
		private readonly errorHandlingService: ErrorHandlingService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.billingService
			.getConfig()
			.pipe(untilDestroyed(this))
			.subscribe({
				next: ({ enabled }) => {
					this.billingEnabled = enabled;
					if (enabled) {
						void this.load();
					} else {
						this.loading = false;
					}
				},
				error: () => {
					// Treat an unreachable config endpoint as "no billing here" rather than an error
					// screen — an older API simply does not have this route.
					this.billingEnabled = false;
					this.loading = false;
				}
			});
	}

	/**
	 * Load everything the page shows.
	 *
	 * Each call is settled independently: a tenant with no subscription yet still gets a usable page
	 * rather than one failure blanking the lot.
	 */
	async load(): Promise<void> {
		this.loading = true;
		this.loadFailed = false;
		try {
			const [subscription, plans, invoices, paymentMethod] = await Promise.all([
				this.safe(() => firstValueFrom(this.billingService.getSubscription()), null),
				this.safe(() => firstValueFrom(this.billingService.getPlans()), [] as IBillingPlan[]),
				this.safe(() => firstValueFrom(this.billingService.getInvoices()), [] as IBillingInvoice[]),
				this.safe(() => firstValueFrom(this.billingService.getPaymentMethod()), null)
			]);

			this.subscription = subscription;
			this.plans = plans;
			this.invoices = invoices;
			this.paymentMethod = paymentMethod;
		} finally {
			this.loading = false;
		}
	}

	/** True when the given plan is the one the tenant is already on. */
	isCurrentPlan(plan: IBillingPlan): boolean {
		return !!this.subscription?.lookupKey && this.subscription.lookupKey === plan.lookupKey;
	}

	async changePlan(plan: IBillingPlan): Promise<void> {
		if (this.working || this.isCurrentPlan(plan)) return;
		this.working = true;
		try {
			this.subscription = await firstValueFrom(this.billingService.changePlan(plan.lookupKey));
			this.toastrService.success('SETTINGS_MENU.BILLING_PLAN_CHANGED', { name: plan.productName });
			// Switching plans issues an invoice, so the list below is now stale.
			this.invoices = await this.safe(() => firstValueFrom(this.billingService.getInvoices()), this.invoices);
		} catch (error) {
			this.errorHandlingService.handleError(error);
		} finally {
			this.working = false;
		}
	}

	async cancel(): Promise<void> {
		if (this.working) return;
		this.working = true;
		try {
			this.subscription = await firstValueFrom(this.billingService.cancel());
			this.toastrService.success('SETTINGS_MENU.BILLING_CANCELLED');
		} catch (error) {
			this.errorHandlingService.handleError(error);
		} finally {
			this.working = false;
		}
	}

	async resume(): Promise<void> {
		if (this.working) return;
		this.working = true;
		try {
			this.subscription = await firstValueFrom(this.billingService.resume());
			this.toastrService.success('SETTINGS_MENU.BILLING_RESUMED');
		} catch (error) {
			this.errorHandlingService.handleError(error);
		} finally {
			this.working = false;
		}
	}

	/** Hand off to Stripe's portal, returning the user to this page afterwards. */
	async openPortal(): Promise<void> {
		if (this.working) return;
		this.working = true;
		try {
			const { url } = await firstValueFrom(this.billingService.openPortal(window.location.href));
			window.location.href = url;
		} catch (error) {
			this.errorHandlingService.handleError(error);
			this.working = false;
		}
	}

	/**
	 * Minor units to a display string, e.g. 2500 + 'usd' -> "$25.00".
	 *
	 * Not every currency divides by 100. Stripe stores zero-decimal currencies (JPY, KRW and friends)
	 * in whole units, so dividing those by 100 would show a price a hundred times too small — the
	 * kind of error nobody reports because it looks like a bargain.
	 */
	formatAmount(amount: number, currency: string): string {
		const code = (currency || 'usd').toUpperCase();
		const value = (amount ?? 0) / (ZERO_DECIMAL_CURRENCIES.has(code) ? 1 : 100);
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
		} catch {
			return `${value.toFixed(ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2)} ${code}`;
		}
	}

	/** "/mo", "/yr", "/wk", "/day", or nothing for a one-off. */
	intervalSuffix(interval: string): string {
		return INTERVAL_SUFFIX[interval] ?? '';
	}

	/**
	 * Run one load, keeping the page usable if it fails.
	 *
	 * The calls are settled independently so a tenant with no subscription still gets a working page —
	 * but a *failed* call is not the same as an empty one. Without recording it, an API outage would
	 * render as a confident "this account has no subscription", which is worse than saying nothing.
	 */
	private async safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
		try {
			return await run();
		} catch (error) {
			this.loadFailed = true;
			this.errorHandlingService.handleError(error);
			return fallback;
		}
	}
}
