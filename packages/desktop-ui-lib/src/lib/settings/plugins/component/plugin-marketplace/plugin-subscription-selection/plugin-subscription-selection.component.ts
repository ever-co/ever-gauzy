import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, combineLatest, map, startWith, tap } from 'rxjs';
import { PluginSubscriptionActions } from '../+state/actions/plugin-subscription.action';
import { PluginSubscriptionQuery } from '../+state/queries/plugin-subscription.query';
import { Store } from '../../../../../services';
import {
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionService,
	PluginSubscriptionType
} from '../../../services/plugin-subscription.service';

export interface IPluginSubscriptionSelectionContext {
	plugin: IPlugin;
	pluginId: string;
}

export interface IPluginSubscriptionSelectionResult {
	subscriptionPlan: IPluginSubscriptionPlan;
	subscriptionInput: IPluginSubscriptionCreateInput;
	proceedWithInstallation: boolean;
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-subscription-selection',
	templateUrl: './plugin-subscription-selection.component.html',
	styleUrls: ['./plugin-subscription-selection.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginSubscriptionSelectionComponent implements OnInit, OnDestroy {
	@Input() plugin: IPlugin;
	@Input() pluginId: string;

	public subscriptionForm: FormGroup;
	public selectedPlan$ = new BehaviorSubject<IPluginSubscriptionPlan | null>(null);

	// State management observables
	public availablePlans$: Observable<IPluginSubscriptionPlan[]>;
	public loading$: Observable<boolean>;
	public creating$: Observable<boolean>;
	public error$: Observable<string | null>;

	// Expose enums to template
	public readonly PluginSubscriptionType = PluginSubscriptionType;
	public readonly PluginBillingPeriod = PluginBillingPeriod;

	// Computed observables
	public hasFreePlan$: Observable<boolean>;
	public hasPaidPlans$: Observable<boolean>;
	public subscriptionPreview$!: Observable<any>;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginSubscriptionSelectionComponent>,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly formBuilder: FormBuilder,
		private readonly store: Store,
		private readonly pluginSubscriptionQuery: PluginSubscriptionQuery,
		private readonly actions$: Actions
	) {
		this.initializeForm();
		this.initializeObservables();
	}

	ngOnInit(): void {
		this.loadSubscriptionPlans();
		this.initializeSubscriptionPreview();
	}

	ngOnDestroy(): void {
		this.selectedPlan$.complete();
	}

	private initializeObservables(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;

		// Use state management observables
		this.availablePlans$ = this.pluginSubscriptionQuery.getPlansForPlugin(targetPluginId!);
		this.loading$ = this.pluginSubscriptionQuery.loading$;
		this.creating$ = this.pluginSubscriptionQuery.creating$;
		this.error$ = this.pluginSubscriptionQuery.error$;

		// Computed observables
		this.hasFreePlan$ = this.availablePlans$.pipe(
			map((plans) => plans.some((plan) => plan.type === PluginSubscriptionType.FREE))
		);

		this.hasPaidPlans$ = this.availablePlans$.pipe(
			map((plans) => plans.some((plan) => plan.type !== PluginSubscriptionType.FREE))
		);
	}

	private initializeForm(): void {
		this.subscriptionForm = this.formBuilder.group({
			planId: ['', Validators.required],
			billingPeriod: [PluginBillingPeriod.MONTHLY],
			paymentMethodId: [''],
			promoCode: [''],
			agreeToTerms: [false, Validators.requiredTrue]
		});

		// React to plan selection
		this.subscriptionForm
			.get('planId')
			?.valueChanges.pipe(
				tap((planId) => {
					this.availablePlans$
						.pipe(
							tap((plans) => {
								const plan = plans.find((p) => p.id === planId);
								this.selectedPlan$.next(plan || null);
							}),
							untilDestroyed(this)
						)
						.subscribe();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initializeSubscriptionPreview(): void {
		this.subscriptionPreview$ = combineLatest([
			this.selectedPlan$,
			this.subscriptionForm.valueChanges.pipe(startWith(this.subscriptionForm.value))
		]).pipe(
			map(([plan, formValues]) => {
				if (!plan) return null;

				const promoCode = (formValues as any).promoCode;
				return {
					baseAmount: plan.price,
					setupFee: plan.setupFee || 0,
					discount: 0, // Will be calculated based on promo code
					totalAmount: plan.price + (plan.setupFee || 0),
					currency: plan.currency,
					billingPeriod: plan.billingPeriod,
					trialDays: plan.trialDays,
					features: plan.features
				};
			})
		);
	}

	private loadSubscriptionPlans(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;
		if (!targetPluginId) {
			console.error('Plugin ID is required');
			return;
		}

		// Dispatch action to load plans
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginPlans(targetPluginId));

		// Watch for plans and auto-select free plan if available
		this.availablePlans$
			.pipe(
				tap((plans) => {
					const freePlan = plans.find((plan) => plan.type === PluginSubscriptionType.FREE);
					if (freePlan && !this.subscriptionForm.value.planId) {
						this.subscriptionForm.patchValue({
							planId: freePlan.id,
							billingPeriod: freePlan.billingPeriod
						});
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public selectPlan(plan: IPluginSubscriptionPlan): void {
		this.subscriptionForm.patchValue({
			planId: plan.id,
			billingPeriod: plan.billingPeriod
		});
	}

	public onBillingPeriodChange(period: PluginBillingPeriod): void {
		const currentPlan = this.selectedPlan$.value;
		if (!currentPlan) return;

		// Find if there's a plan with the same type but different billing period
		this.availablePlans$
			.pipe(
				tap((plans) => {
					const alternativePlan = plans.find(
						(plan) => plan.type === currentPlan.type && plan.billingPeriod === period
					);

					if (alternativePlan) {
						this.selectPlan(alternativePlan);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public async validatePromoCode(): Promise<void> {
		const promoCode = this.subscriptionForm.get('promoCode')?.value;
		if (!promoCode) return;

		try {
			const validation = await this.subscriptionService
				.validatePromoCode(promoCode, this.pluginId || this.plugin?.id)
				.toPromise();

			if (validation?.valid) {
				console.log('Promo code applied successfully');
				// Update the preview with discount
			} else {
				console.log('Invalid promo code');
			}
		} catch (error) {
			console.log('Failed to validate promo code');
		}
	}

	public onSubscribeAndInstall(): void {
		if (!this.subscriptionForm.valid) {
			this.subscriptionForm.markAllAsTouched();
			return;
		}

		const selectedPlan = this.selectedPlan$.value;
		if (!selectedPlan) {
			console.log('Please select a subscription plan');
			return;
		}

		const subscriptionInput: IPluginSubscriptionCreateInput = {
			pluginId: this.pluginId || this.plugin?.id!,
			planId: selectedPlan.id,
			subscriptionType: selectedPlan.type,
			billingPeriod: this.subscriptionForm.value.billingPeriod,
			paymentMethodId: this.subscriptionForm.value.paymentMethodId,
			promoCode: this.subscriptionForm.value.promoCode,
			metadata: {
				source: 'plugin-marketplace',
				pluginName: this.plugin?.name
			}
		};

		if (selectedPlan.type === PluginSubscriptionType.FREE) {
			// For free plans, proceed directly to installation
			this.proceedWithInstallation(selectedPlan, subscriptionInput);
		} else {
			// For paid plans, create subscription using state management
			this.createSubscription(selectedPlan, subscriptionInput);
		}
	}

	private createSubscription(plan: IPluginSubscriptionPlan, input: IPluginSubscriptionCreateInput): void {
		// Dispatch create subscription action
		this.actions$.dispatch(PluginSubscriptionActions.createSubscription(input.pluginId, input));

		// Watch for successful creation
		this.creating$
			.pipe(
				tap((creating) => {
					if (!creating && !this.pluginSubscriptionQuery.error) {
						// Success case - proceed with installation
						console.log(
							`Successfully subscribed to ${plan.name} plan for ${this.plugin?.name || 'plugin'}`
						);
						this.proceedWithInstallation(plan, input);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Watch for errors
		this.error$
			.pipe(
				tap((error) => {
					if (error) {
						console.error('Failed to create subscription:', error);
						console.log('Failed to create subscription. Please try again.');
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private proceedWithInstallation(plan: IPluginSubscriptionPlan, input: IPluginSubscriptionCreateInput): void {
		const result: IPluginSubscriptionSelectionResult = {
			subscriptionPlan: plan,
			subscriptionInput: input,
			proceedWithInstallation: true
		};

		this.dialogRef.close(result);
	}

	public onCancel(): void {
		this.dialogRef.close(null);
	}

	public onSkipSubscription(): void {
		// Allow proceeding without subscription for free plugins or if user wants to install without subscription
		const result: IPluginSubscriptionSelectionResult = {
			subscriptionPlan: null!,
			subscriptionInput: null!,
			proceedWithInstallation: true
		};

		this.dialogRef.close(result);
	}

	// Helper methods for template
	public getPlanTypeIcon(type: PluginSubscriptionType): string {
		switch (type) {
			case PluginSubscriptionType.FREE:
				return 'gift-outline';
			case PluginSubscriptionType.TRIAL:
				return 'clock-outline';
			case PluginSubscriptionType.BASIC:
				return 'person-outline';
			case PluginSubscriptionType.PREMIUM:
				return 'star-outline';
			case PluginSubscriptionType.ENTERPRISE:
				return 'briefcase-outline';
			default:
				return 'info-outline';
		}
	}

	public getPlanTypeColor(type: PluginSubscriptionType): string {
		switch (type) {
			case PluginSubscriptionType.FREE:
				return 'success';
			case PluginSubscriptionType.TRIAL:
				return 'info';
			case PluginSubscriptionType.BASIC:
				return 'basic';
			case PluginSubscriptionType.PREMIUM:
				return 'warning';
			case PluginSubscriptionType.ENTERPRISE:
				return 'danger';
			default:
				return 'basic';
		}
	}

	public formatPrice(amount: number, currency: string): string {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: currency || 'USD'
		}).format(amount);
	}

	public formatBillingPeriod(period: PluginBillingPeriod): string {
		return this.subscriptionService.formatBillingPeriod(period);
	}

	public get canProceedWithoutSubscription(): boolean {
		// Allow skipping subscription if there are free plans or if it's optional
		let hasFreePlans = false;
		this.hasFreePlan$.subscribe((value) => (hasFreePlans = value)).unsubscribe();
		return hasFreePlans || this.plugin?.type === ('FREE' as any);
	}
}
