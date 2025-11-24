import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IPluginSubscriptionPlan } from '../../../../../services/plugin-subscription.service';
import { SubscriptionFormService } from '../../services/subscription-form.service';

/**
 * Reusable billing form component (Smart Component)
 * Following:
 * - Single Responsibility: Handle billing form logic
 * - Dependency Inversion: Depends on SubscriptionFormService abstraction
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
	public monthlyPrice: number = 0;
	public quarterlyPrice: number = 0;
	public quarterlyDetail: number = 0;
	public yearlyPrice: number = 0;
	public yearlyDetail: number = 0;
	@Input() form: FormGroup;
	@Input() plan: IPluginSubscriptionPlan;
	@Input() isLoading = false;
	@Input() isUpgrade = false;
	@Input() isDowngrade = false;
	@Input() showPaymentSection = true;

	@Output() formSubmit = new EventEmitter<FormGroup>();
	@Output() formCancel = new EventEmitter<void>();

	constructor(private readonly formService: SubscriptionFormService) {}

	ngOnInit(): void {
		if (this.form) {
			this.setupPaymentMethodListener();
		}
		// Precompute price values for template
		this.monthlyPrice = Number(this.plan?.price) || 0;
		this.quarterlyPrice = this.monthlyPrice * 3 * 0.95;
		this.quarterlyDetail = this.monthlyPrice * 3;
		this.yearlyPrice = this.monthlyPrice * 12 * 0.8;
		this.yearlyDetail = this.monthlyPrice * 12;
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	private setupPaymentMethodListener(): void {
		this.form.get('paymentMethod')?.valueChanges
			.pipe(untilDestroyed(this))
			.subscribe((paymentMethod) => {
				this.formService.updateCardFieldValidators(this.form, paymentMethod);
			});
	}

	onSubmit(): void {
		if (this.form.valid) {
			this.formSubmit.emit(this.form);
		} else {
			this.formService.markFormGroupTouched(this.form);
		}
	}

	onCancel(): void {
		this.formCancel.emit();
	}

	hasError(controlName: string, errorName: string): boolean {
		return this.formService.hasError(this.form, controlName, errorName);
	}

	isCardPaymentMethod(): boolean {
		return this.form.get('paymentMethod')?.value === 'card';
	}

	getActionText(): string {
		if (this.isUpgrade) return 'Upgrade Now';
		if (this.isDowngrade) return 'Downgrade Now';
		return 'Subscribe Now';
	}

	getActionStatus(): string {
		if (this.isUpgrade) return 'success';
		if (this.isDowngrade) return 'warning';
		return 'primary';
	}

	getHeaderText(): string {
		if (this.isUpgrade) return 'Upgrade Billing Information';
		if (this.isDowngrade) return 'Downgrade Billing Information';
		return 'Billing Information';
	}

	getDescriptionText(): string {
		const action = this.isUpgrade ? 'upgrading' : this.isDowngrade ? 'downgrading' : 'subscribing';
		return `You're ${action} to`;
	}
}
