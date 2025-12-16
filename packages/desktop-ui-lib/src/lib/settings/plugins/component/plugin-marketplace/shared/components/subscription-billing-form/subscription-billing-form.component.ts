import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	Output,
	SimpleChanges,
	inject
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IPluginSubscriptionPlan, PluginBillingPeriod } from '../../../../../services/plugin-subscription.service';
import { SubscriptionFormService } from '../../services/subscription-form.service';
import { BillingOption, BillingPeriodKey, PaymentMethod } from './types';
export { BillingOption, BillingPeriodKey, PaymentMethod } from './types';

/**
 * Reusable billing form component
 *
 * Responsibilities:
 * - Display subscription billing form with multiple payment options
 * - Handle form validation and submission
 * - Support upgrade/downgrade flows with contextual messaging
 * - Calculate and display pricing for different billing periods
 *
 * @example
 * <gauzy-subscription-billing-form
 *   [form]="billingForm"
 *   [plan]="selectedPlan"
 *   [isUpgrade]="true"
 *   (formSubmit)="handleSubmit($event)"
 *   (formCancel)="handleCancel()">
 * </gauzy-subscription-billing-form>
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-subscription-billing-form',
	templateUrl: './subscription-billing-form.component.html',
	styleUrls: ['./subscription-billing-form.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class SubscriptionBillingFormComponent implements OnInit, OnDestroy, OnChanges {
	private readonly formService = inject(SubscriptionFormService);

	/** Derived billing options for the UI */
	protected billingOptions: BillingOption[] = [];

	/** Reactive form instance for billing information */
	@Input() form!: FormGroup;

	/** Selected subscription plan details */
	@Input() plan!: IPluginSubscriptionPlan;

	/** Loading state for form submission */
	@Input() isLoading = false;

	/** Whether this is an upgrade flow */
	@Input() isUpgrade = false;

	/** Whether this is a downgrade flow */
	@Input() isDowngrade = false;

	/** Whether to show payment method section */
	@Input() showPaymentSection = true;

	/** Available payment methods */
	protected readonly paymentMethods: PaymentMethod[] = [
		{
			value: 'card',
			title: 'Credit or debit card',
			subtitle: 'Visa, Mastercard, American Express',
			icon: 'credit-card-outline',
			badge: { text: 'Recommended', status: 'primary' },
			details: ['Instant activation', '3D Secure ready', 'Supports corporate cards']
		},
		{
			value: 'paypal',
			title: 'PayPal',
			subtitle: 'Fast and secure checkout',
			icon: 'at-outline',
			details: ['Use existing balance', 'No card entry required', 'Works with PayPal credit']
		}
	];

	/** Emitted when form is submitted successfully */
	@Output() formSubmit = new EventEmitter<FormGroup>();

	/** Emitted when user cancels the form */
	@Output() formCancel = new EventEmitter<void>();

	ngOnInit(): void {
		this.setupPaymentMethodListener();
		this.buildBillingOptions();
	}

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['plan'] || changes['pricingMatrix'] || changes['pricingCopy'] || changes['highlightedPeriod']) {
			this.buildBillingOptions();
		}
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	/**
	 * Build billing options from provided pricing data to avoid hard-coded calculations
	 */
	private buildBillingOptions(): void {
		if (!this.plan) {
			this.billingOptions = [];
			return;
		}

		const pricing = this.getPlanPricingMatrix(this.plan);
		const copy = this.getPlanPricingCopy(this.plan);
		const defaultPrice = this.normalizePrice(pricing, 'monthly', this.plan.price);

		const options: BillingOption[] = [
			{
				period: 'monthly',
				label: 'Monthly',
				description: copy.monthly ?? 'Billed monthly',
				price: defaultPrice
			},
			{
				period: 'quarterly',
				label: 'Quarterly',
				description: copy.quarterly ?? 'Billed every quarter',
				price: this.normalizePrice(pricing, 'quarterly', pricing.monthly ?? defaultPrice)
			},
			{
				period: 'yearly',
				label: 'Yearly',
				description: copy.yearly ?? 'Billed annually',
				price: this.normalizePrice(pricing, 'yearly', pricing.monthly ?? defaultPrice)
			}
		];

		const highlighted = this.getPlanHighlightedPeriod(this.plan);

		this.billingOptions = options.map((option) =>
			option.period === highlighted ? { ...option, badge: { text: 'Recommended', status: 'primary' } } : option
		);
	}

	private getPlanPricingMatrix(plan: IPluginSubscriptionPlan): Partial<Record<BillingPeriodKey, number>> {
		const key = this.mapBillingPeriod(plan?.billingPeriod);
		if (!key) return {};
		return { [key]: Number(plan.price) };
	}

	private getPlanPricingCopy(plan: IPluginSubscriptionPlan): Partial<Record<BillingPeriodKey, string>> {
		const key = this.mapBillingPeriod(plan?.billingPeriod);
		if (!key) return {};
		return { [key]: plan.description ?? undefined };
	}

	private getPlanHighlightedPeriod(plan: IPluginSubscriptionPlan): BillingPeriodKey | null {
		return this.mapBillingPeriod(plan?.billingPeriod);
	}

	private mapBillingPeriod(period?: PluginBillingPeriod): BillingPeriodKey | null {
		switch (period) {
			case PluginBillingPeriod.MONTHLY:
				return 'monthly';
			case PluginBillingPeriod.QUARTERLY:
				return 'quarterly';
			case PluginBillingPeriod.YEARLY:
				return 'yearly';
			default:
				return null;
		}
	}

	private normalizePrice(
		pricing: Partial<Record<BillingPeriodKey, number | string>>,
		period: BillingPeriodKey,
		fallback?: number | string
	): number {
		const candidate = pricing?.[period];
		const normalized = Number(candidate ?? fallback ?? 0);
		return Number.isFinite(normalized) ? normalized : 0;
	}

	/**
	 * Set up listener for payment method changes to toggle card field validation
	 */
	private setupPaymentMethodListener(): void {
		this.form
			.get('paymentMethod')
			?.valueChanges.pipe(untilDestroyed(this))
			.subscribe((paymentMethod: string) => {
				this.formService.updateCardFieldValidators(this.form, paymentMethod);
			});
	}

	/**
	 * Handle form submission
	 * Validates form and emits submission event if valid
	 */
	protected onSubmit(): void {
		if (this.form.valid) {
			this.formSubmit.emit(this.form);
		} else {
			this.formService.markFormGroupTouched(this.form);
		}
	}

	/**
	 * Handle form cancellation
	 */
	protected onCancel(): void {
		this.formCancel.emit();
	}

	/**
	 * Check if a form control has a specific error
	 * @param controlName - Name of the form control
	 * @param errorName - Name of the validation error
	 */
	public readonly hasError = (controlName: string, errorName: string): boolean => {
		return this.formService.hasError(this.form, controlName, errorName);
	};

	/**
	 * Check if card payment method is selected
	 */
	protected isCardPaymentMethod(): boolean {
		return this.form.get('paymentMethod')?.value === 'card';
	}

	/**
	 * Get action button text based on flow type
	 */
	protected getActionText(): string {
		if (this.isUpgrade) return 'Upgrade Now';
		if (this.isDowngrade) return 'Downgrade Now';
		return 'Subscribe Now';
	}

	/**
	 * Get action button status/color based on flow type
	 */
	protected getActionStatus(): string {
		if (this.isUpgrade) return 'success';
		if (this.isDowngrade) return 'warning';
		return 'primary';
	}

	/**
	 * Get form header text based on flow type
	 */
	protected getHeaderText(): string {
		if (this.isUpgrade) return 'Upgrade Billing Information';
		if (this.isDowngrade) return 'Downgrade Billing Information';
		return 'Billing Information';
	}

	/**
	 * Get form description text based on flow type
	 */
	protected getDescriptionText(): string {
		const action = this.isUpgrade ? 'upgrading' : this.isDowngrade ? 'downgrading' : 'subscribing';
		return `You're ${action} to`;
	}
}
