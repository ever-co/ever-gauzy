import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy } from '@ngneat/until-destroy';
import { BehaviorSubject } from 'rxjs';

// Define subscription types locally since they might not be available in contracts
enum PluginSubscriptionType {
	FREE = 'free',
	TRIAL = 'trial',
	BASIC = 'basic',
	PREMIUM = 'premium',
	ENTERPRISE = 'enterprise'
}

enum PluginBillingPeriod {
	MONTHLY = 'monthly',
	QUARTERLY = 'quarterly',
	YEARLY = 'yearly'
}

interface ISubscriptionPlan {
	type: PluginSubscriptionType;
	name: string;
	description: string;
	price: number;
	currency: string;
	billingPeriod: PluginBillingPeriod;
	features: string[];
	isPopular?: boolean;
	isRecommended?: boolean;
	trialDays?: number;
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-subscription-manager',
	templateUrl: './plugin-subscription-manager.component.html',
	styleUrls: ['./plugin-subscription-manager.component.scss'],
	standalone: false
})
export class PluginSubscriptionManagerComponent implements OnInit, OnDestroy {
	@Input() plugin: IPlugin;
	@Input() currentSubscription: any; // Replace with proper interface when available

	public subscriptionForm: FormGroup;
	public isLoading$ = new BehaviorSubject<boolean>(false);
	public availablePlans: ISubscriptionPlan[] = [];
	public selectedPlan: ISubscriptionPlan | null = null;
	public showBillingForm = false;

	// Enum references for template
	public PluginSubscriptionType = PluginSubscriptionType;
	public PluginBillingPeriod = PluginBillingPeriod;

	constructor(
		private readonly formBuilder: FormBuilder,
		private readonly dialogService: NbDialogService,
		private readonly dialogRef: NbDialogRef<PluginSubscriptionManagerComponent>
	) {
		this.initializeForm();
		this.initializeAvailablePlans();
	}

	ngOnInit(): void {
		this.loadCurrentSubscription();
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	private initializeForm(): void {
		this.subscriptionForm = this.formBuilder.group({
			subscriptionType: ['', Validators.required],
			billingPeriod: [PluginBillingPeriod.MONTHLY, Validators.required],
			autoRenew: [true],
			paymentMethod: ['', Validators.required],
			cardNumber: ['', [Validators.required, Validators.pattern(/^\d{16}$/)]],
			expiryDate: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
			cvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
			billingName: ['', Validators.required],
			billingEmail: ['', [Validators.required, Validators.email]],
			acceptTerms: [false, Validators.requiredTrue]
		});
	}

	private initializeAvailablePlans(): void {
		this.availablePlans = [
			{
				type: PluginSubscriptionType.FREE,
				name: 'Free',
				description: 'Basic features for personal use',
				price: 0,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: ['Basic plugin functionality', 'Community support', 'Limited usage', 'Standard updates']
			},
			{
				type: PluginSubscriptionType.TRIAL,
				name: 'Free Trial',
				description: 'Try premium features for 14 days',
				price: 0,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				trialDays: 14,
				features: [
					'All premium features',
					'Priority support',
					'Advanced configuration',
					'Analytics dashboard',
					'API access'
				]
			},
			{
				type: PluginSubscriptionType.BASIC,
				name: 'Basic',
				description: 'Essential features for small teams',
				price: 9.99,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: [
					'Enhanced plugin functionality',
					'Email support',
					'Advanced settings',
					'Usage analytics',
					'Team collaboration (up to 5 users)'
				]
			},
			{
				type: PluginSubscriptionType.PREMIUM,
				name: 'Premium',
				description: 'Advanced features for growing teams',
				price: 19.99,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				isPopular: true,
				isRecommended: true,
				features: [
					'All Basic features',
					'Priority support',
					'Advanced analytics',
					'Custom integrations',
					'Team collaboration (up to 25 users)',
					'Custom branding',
					'API access'
				]
			},
			{
				type: PluginSubscriptionType.ENTERPRISE,
				name: 'Enterprise',
				description: 'Complete solution for large organizations',
				price: 49.99,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: [
					'All Premium features',
					'Dedicated support',
					'Custom development',
					'On-premise deployment',
					'Unlimited users',
					'Advanced security',
					'SLA guarantee',
					'Training & onboarding'
				]
			}
		];
	}

	private loadCurrentSubscription(): void {
		if (this.currentSubscription) {
			this.selectedPlan =
				this.availablePlans.find((plan) => plan.type === this.currentSubscription.subscriptionType) || null;
		}
	}

	public selectPlan(plan: ISubscriptionPlan): void {
		this.selectedPlan = plan;
		this.subscriptionForm.patchValue({
			subscriptionType: plan.type,
			billingPeriod: plan.billingPeriod
		});

		if (plan.type === PluginSubscriptionType.FREE) {
			this.subscribeToPlan();
		} else {
			this.showBillingForm = true;
		}
	}

	public subscribeToPlan(): void {
		if (!this.selectedPlan) return;

		if (this.selectedPlan.type !== PluginSubscriptionType.FREE && !this.subscriptionForm.valid) {
			this.markFormGroupTouched();
			return;
		}

		this.isLoading$.next(true);

		// Simulate API call
		setTimeout(() => {
			this.isLoading$.next(false);
			this.dialogRef.close({
				success: true,
				subscription: {
					pluginId: this.plugin.id,
					subscriptionType: this.selectedPlan.type,
					billingPeriod: this.selectedPlan.billingPeriod,
					price: this.selectedPlan.price,
					currency: this.selectedPlan.currency,
					autoRenew: this.subscriptionForm.get('autoRenew')?.value || true
				}
			});
		}, 2000);
	}

	public cancelSubscription(): void {
		if (!this.currentSubscription) return;

		this.dialogService
			.open(this.getCancelConfirmationDialog(), {
				context: {
					title: 'Cancel Subscription',
					message:
						'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.',
					confirmText: 'Cancel Subscription',
					cancelText: 'Keep Subscription'
				}
			})
			.onClose.subscribe((confirmed: boolean) => {
				if (confirmed) {
					this.isLoading$.next(true);
					// Simulate API call
					setTimeout(() => {
						this.isLoading$.next(false);
						this.dialogRef.close({
							success: true,
							action: 'cancelled'
						});
					}, 1000);
				}
			});
	}

	public upgradeSubscription(): void {
		this.showBillingForm = true;
	}

	public downgradeSubscription(): void {
		this.dialogService
			.open(this.getDowngradeConfirmationDialog(), {
				context: {
					title: 'Downgrade Subscription',
					message:
						'Downgrading will reduce your available features. This change will take effect at the end of your current billing period.',
					confirmText: 'Downgrade',
					cancelText: 'Cancel'
				}
			})
			.onClose.subscribe((confirmed: boolean) => {
				if (confirmed) {
					this.showBillingForm = true;
				}
			});
	}

	public getPlanPrice(plan: ISubscriptionPlan): string {
		if (plan.price === 0) {
			return plan.type === PluginSubscriptionType.TRIAL ? 'Free Trial' : 'Free';
		}

		const period =
			plan.billingPeriod === PluginBillingPeriod.YEARLY
				? 'year'
				: plan.billingPeriod === PluginBillingPeriod.QUARTERLY
				? 'quarter'
				: 'month';

		return `$${plan.price}/${period}`;
	}

	public getPlanSavings(plan: ISubscriptionPlan): string | null {
		if (plan.billingPeriod === PluginBillingPeriod.YEARLY) {
			const monthlyEquivalent = plan.price / 12;
			const monthlySavings = (plan.price * 1.2) / 12 - monthlyEquivalent;
			return `Save $${monthlySavings.toFixed(2)}/month`;
		}
		return null;
	}

	public isCurrentPlan(plan: ISubscriptionPlan): boolean {
		return this.currentSubscription?.subscriptionType === plan.type;
	}

	public canUpgrade(plan: ISubscriptionPlan): boolean {
		if (!this.currentSubscription) return plan.type !== PluginSubscriptionType.FREE;

		const currentIndex = this.getSubscriptionTypeIndex(this.currentSubscription.subscriptionType);
		const planIndex = this.getSubscriptionTypeIndex(plan.type);

		return planIndex > currentIndex;
	}

	public canDowngrade(plan: ISubscriptionPlan): boolean {
		if (!this.currentSubscription) return false;

		const currentIndex = this.getSubscriptionTypeIndex(this.currentSubscription.subscriptionType);
		const planIndex = this.getSubscriptionTypeIndex(plan.type);

		return planIndex < currentIndex;
	}

	private getSubscriptionTypeIndex(type: PluginSubscriptionType): number {
		const order = [
			PluginSubscriptionType.FREE,
			PluginSubscriptionType.TRIAL,
			PluginSubscriptionType.BASIC,
			PluginSubscriptionType.PREMIUM,
			PluginSubscriptionType.ENTERPRISE
		];
		return order.indexOf(type);
	}

	private markFormGroupTouched(): void {
		Object.keys(this.subscriptionForm.controls).forEach((key) => {
			this.subscriptionForm.get(key)?.markAsTouched();
		});
	}

	private getCancelConfirmationDialog(): any {
		// Return a confirmation dialog component reference
		// This would be implemented based on your dialog system
		return null; // Placeholder
	}

	private getDowngradeConfirmationDialog(): any {
		// Return a confirmation dialog component reference
		// This would be implemented based on your dialog system
		return null; // Placeholder
	}

	public close(): void {
		this.dialogRef.close();
	}

	public getStatusIcon(status: string): string {
		switch (status?.toLowerCase()) {
			case 'active':
				return 'checkmark-circle-outline';
			case 'trial':
				return 'clock-outline';
			case 'expired':
				return 'alert-triangle-outline';
			case 'cancelled':
				return 'close-circle-outline';
			case 'suspended':
				return 'pause-circle-outline';
			default:
				return 'info-outline';
		}
	}
}
