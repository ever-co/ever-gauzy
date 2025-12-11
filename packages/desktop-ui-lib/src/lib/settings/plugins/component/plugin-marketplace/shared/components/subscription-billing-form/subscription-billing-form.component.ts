import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Input,
	OnDestroy,
	OnInit,
	Output,
	inject
} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IPluginSubscriptionPlan } from '../../../../../services/plugin-subscription.service';
import { SubscriptionFormService } from '../../services/subscription-form.service';

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
@UntilDestroy()
@Component({
	selector: 'gauzy-subscription-billing-form',
	templateUrl: './subscription-billing-form.component.html',
	styleUrls: ['./subscription-billing-form.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class SubscriptionBillingFormComponent implements OnInit, OnDestroy {
	private readonly formService = inject(SubscriptionFormService);

	/** Calculated monthly price */
	protected monthlyPrice = 0;

	/** Calculated quarterly price with 5% discount */
	protected quarterlyPrice = 0;

	/** Quarterly detail showing total before discount */
	protected quarterlyDetail = 0;

	/** Calculated yearly price with 20% discount */
	protected yearlyPrice = 0;

	/** Yearly detail showing total before discount */
	protected yearlyDetail = 0;

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

	/** Emitted when form is submitted successfully */
	@Output() formSubmit = new EventEmitter<FormGroup>();

	/** Emitted when user cancels the form */
	@Output() formCancel = new EventEmitter<void>();

	ngOnInit(): void {
		this.setupPaymentMethodListener();
		this.calculatePricing();
	}

	/**
	 * Calculate pricing for different billing periods
	 * - Quarterly: 5% discount
	 * - Yearly: 20% discount
	 */
	private calculatePricing(): void {
		const basePrice = Number(this.plan?.price) || 0;
		const QUARTERLY_MONTHS = 3;
		const YEARLY_MONTHS = 12;
		const QUARTERLY_DISCOUNT = 0.95; // 5% off
		const YEARLY_DISCOUNT = 0.8; // 20% off

		this.monthlyPrice = basePrice;
		this.quarterlyDetail = basePrice * QUARTERLY_MONTHS;
		this.quarterlyPrice = this.quarterlyDetail * QUARTERLY_DISCOUNT;
		this.yearlyDetail = basePrice * YEARLY_MONTHS;
		this.yearlyPrice = this.yearlyDetail * YEARLY_DISCOUNT;
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
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
	protected hasError(controlName: string, errorName: string): boolean {
		return this.formService.hasError(this.form, controlName, errorName);
	}

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
