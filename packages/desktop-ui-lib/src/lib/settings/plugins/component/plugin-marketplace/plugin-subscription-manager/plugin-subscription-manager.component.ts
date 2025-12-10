import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { IPlugin, PluginScope } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { PluginInstallationQuery } from '../+state';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginSubscriptionFacade } from '../+state/plugin-subscription.facade';
import {
	IPluginSubscription,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../services/plugin-subscription.service';
import { IPlanViewModel, PlanFormatterService } from '../plugin-subscription-plan-selection';
import { SubscriptionFormService, SubscriptionPlanService, SubscriptionStatusService } from '../shared';

@UntilDestroy()
@Component({
	selector: 'lib-plugin-subscription-manager',
	templateUrl: './plugin-subscription-manager.component.html',
	styleUrls: ['./plugin-subscription-manager.component.scss'],
	standalone: false
})
export class PluginSubscriptionManagerComponent implements OnInit, OnDestroy {
	@Input() plugin: IPlugin;
	@Input() currentSubscription: IPluginSubscription | null = null;

	public subscriptionForm: FormGroup;
	public isLoading$: Observable<boolean>;
	public availablePlans$: Observable<IPluginSubscriptionPlan[]>;
	public planViewModels$: Observable<IPlanViewModel[]>;
	public currentPlan$: Observable<IPluginSubscriptionPlan | null>;
	public selectedPlanViewModel: IPlanViewModel | null = null;
	public selectedPlan: IPluginSubscriptionPlan | null = null;
	public showBillingForm = false;

	// Enum references for template
	public PluginSubscriptionType = PluginSubscriptionType;
	public PluginBillingPeriod = PluginBillingPeriod;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginSubscriptionManagerComponent>,
		private readonly facade: PluginSubscriptionFacade,
		public readonly planService: SubscriptionPlanService,
		private readonly formService: SubscriptionFormService,
		public readonly statusService: SubscriptionStatusService,
		public readonly formatter: PlanFormatterService,
		public readonly installationQuery: PluginInstallationQuery,
		private readonly actions: Actions
	) {
		this.subscriptionForm = this.formService.createSubscriptionForm();
		this.isLoading$ = this.facade.loading$;
	}

	ngOnInit(): void {
		if (this.plugin?.id) {
			// Load subscription plans for this plugin
			this.facade.loadPluginPlans(this.plugin.id);
			this.availablePlans$ = this.facade.getCurrentPluginPlans(this.plugin.id);

			// Transform plans to view models
			this.planViewModels$ = this.availablePlans$.pipe(
				map((plans) => this.formatter.transformToViewModels(plans)),
				untilDestroyed(this)
			);

			// If no current subscription passed, try to load it

			this.facade
				.getCurrentPluginSubscription(this.plugin.id)
				.pipe(take(1), untilDestroyed(this))
				.subscribe((subscription) => {
					this.currentSubscription = subscription;
				});

			// Reactively compute the current plan from subscription and available plans
			this.setupCurrentPlan();

			// Setup payment method validation
			this.setupPaymentMethodListener();
		}
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	/**
	 * Setup listener to update card field validators based on payment method selection
	 */
	private setupPaymentMethodListener(): void {
		this.subscriptionForm
			.get('paymentMethod')
			?.valueChanges.pipe(untilDestroyed(this))
			.subscribe((paymentMethod) => {
				this.formService.updateCardFieldValidators(this.subscriptionForm, paymentMethod);
			});
	}

	/**
	 * Setup reactive observable to find the current subscription plan
	 * This ensures the plan is found even when plans are loaded asynchronously
	 */
	private setupCurrentPlan(): void {
		if (!this.availablePlans$) {
			console.warn('[PluginSubscriptionManager] availablePlans$ is not initialized');
			return;
		}

		this.currentPlan$ = this.availablePlans$.pipe(
			map((plans) => {
				if (!this.currentSubscription?.planId) {
					console.log('[PluginSubscriptionManager] No current subscription or planId');
					return null;
				}

				console.log('[PluginSubscriptionManager] Searching for plan:', {
					planId: this.currentSubscription.planId,
					availablePlansCount: plans?.length || 0,
					plans: plans?.map((p) => ({ id: p.id, name: p.name }))
				});

				const foundPlan = plans.find((p) => p.id === this.currentSubscription!.planId) || null;

				if (!foundPlan) {
					console.warn(
						'[PluginSubscriptionManager] Plan not found for planId:',
						this.currentSubscription.planId
					);
				} else {
					console.log('[PluginSubscriptionManager] Found plan:', foundPlan.name);
				}

				return foundPlan;
			}),
			untilDestroyed(this)
		);

		// Subscribe to set the selectedPlan for use in non-template code
		this.currentPlan$.pipe(untilDestroyed(this)).subscribe((plan) => {
			this.selectedPlan = plan;
		});
	}

	public onPlanSelected(planViewModel: IPlanViewModel): void {
		const plan = planViewModel.originalPlan;
		console.log('[SubscriptionManager] Plan selected:', {
			plan: plan,
			type: plan.type,
			hasCurrentSubscription: !!this.currentSubscription,
			willShowForm: plan.type !== PluginSubscriptionType.FREE
		});

		this.selectedPlanViewModel = planViewModel;
		this.selectedPlan = plan;
		this.subscriptionForm.patchValue({
			subscriptionType: plan.type,
			billingPeriod: plan.billingPeriod
		});

		// If it's the current plan, do nothing
		if (this.isCurrentPlan(plan)) {
			console.log('[SubscriptionManager] Selected plan is current plan, no action needed');
			return;
		}

		// If subscription exists and upgrading/downgrading, show billing form
		if (this.currentSubscription) {
			if (this.canUpgrade(plan) || this.canDowngrade(plan)) {
				this.showBillingForm = true;
				const currentType = this.currentSubscription.plan?.type;
				console.log('[SubscriptionManager] Billing form shown for plan change:', {
					action: this.canUpgrade(plan) ? 'upgrade' : 'downgrade',
					fromPlan: currentType,
					toPlan: plan.type
				});
			}
			return;
		}

		// New subscription flow
		if (plan.type === PluginSubscriptionType.FREE) {
			this.subscribeToPlan();
		} else {
			this.showBillingForm = true;
			console.log('[SubscriptionManager] Billing form shown, form state:', {
				formValid: this.subscriptionForm.valid,
				paymentMethod: this.subscriptionForm.get('paymentMethod')?.value
			});
		}
	}

	public subscribeToPlan(): void {
		if (!this.selectedPlan || !this.plugin?.id) return;

		if (this.selectedPlan.type !== PluginSubscriptionType.FREE && !this.subscriptionForm.valid) {
			console.log('[SubscriptionManager] Form validation failed:', {
				formValid: this.subscriptionForm.valid,
				formValue: this.subscriptionForm.value,
				formErrors: this.formService.getFormValidationErrors(this.subscriptionForm)
			});
			this.formService.markFormGroupTouched(this.subscriptionForm);
			return;
		}

		// If subscription exists, handle upgrade/downgrade
		if (this.currentSubscription) {
			if (this.canUpgrade(this.selectedPlan)) {
				this.upgradeSubscription(this.selectedPlan);
			} else if (this.canDowngrade(this.selectedPlan)) {
				this.downgradeSubscription(this.selectedPlan);
			}
			return;
		}

		// New subscription flow
		const subscriptionInput = {
			pluginId: this.plugin.id,
			planId: this.selectedPlan.id,
			scope: PluginScope.USER,
			autoRenew: this.subscriptionForm.get('autoRenew')?.value ?? true,
			paymentMethodId: this.subscriptionForm.get('paymentMethod')?.value
		};

		this.facade.createSubscription(this.plugin.id, subscriptionInput);

		this.facade.creating$.pipe(take(2), untilDestroyed(this)).subscribe((creating) => {
			if (!creating) {
				this.facade.error$.pipe(take(1), untilDestroyed(this)).subscribe((error) => {
					if (!error) {
						this.dialogRef.close({
							success: true,
							action: 'subscribed',
							subscription: this.selectedPlan
						});
					}
				});
			}
		});
	}

	public cancelSubscription(): void {
		if (!this.currentSubscription || !this.plugin?.id) return;

		if (
			confirm(
				'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.'
			)
		) {
			this.facade.cancelSubscription(this.plugin.id, this.currentSubscription.id);

			this.facade.deleting$.pipe(take(2), untilDestroyed(this)).subscribe((deleting) => {
				if (!deleting) {
					this.dialogRef.close({
						success: true,
						action: 'cancelled'
					});
				}
			});
		}
	}

	public upgradeSubscription(plan?: IPluginSubscriptionPlan): void {
		const targetPlan = plan || this.selectedPlan;
		if (!targetPlan || !this.currentSubscription || !this.plugin?.id) return;

		if (
			confirm(
				`Upgrade to ${targetPlan.name} for ${this.getPlanPrice(
					targetPlan
				)}? You'll be charged a prorated amount for the remainder of your current billing period.`
			)
		) {
			console.log('[SubscriptionManager] Upgrading subscription to:', targetPlan.name);

			// Update the subscription with new plan type and billing period
			this.facade.upgradeSubscription(this.plugin.id, this.currentSubscription.id, targetPlan.id);

			this.facade.updating$.pipe(take(2), untilDestroyed(this)).subscribe((updating) => {
				if (!updating) {
					this.facade.error$.pipe(take(1), untilDestroyed(this)).subscribe((error) => {
						if (!error) {
							this.dialogRef.close({
								success: true,
								action: 'upgraded',
								subscription: targetPlan
							});
						}
					});
				}
			});
		}
	}

	public downgradeSubscription(plan?: IPluginSubscriptionPlan): void {
		const targetPlan = plan || this.selectedPlan;
		if (!targetPlan || !this.currentSubscription || !this.plugin?.id) return;

		if (
			confirm(
				`Downgrade to ${targetPlan.name} for ${this.getPlanPrice(
					targetPlan
				)}? This change will take effect at the end of your current billing period. You'll retain access to your current features until then.`
			)
		) {
			console.log('[SubscriptionManager] Downgrading subscription to:', targetPlan.name);

			// Update the subscription with new plan type and billing period
			this.facade.downgradeSubscription(this.plugin.id, this.currentSubscription.id, targetPlan.id);

			this.facade.updating$.pipe(take(2), untilDestroyed(this)).subscribe((updating) => {
				if (!updating) {
					this.facade.error$.pipe(take(1), untilDestroyed(this)).subscribe((error) => {
						if (!error) {
							this.dialogRef.close({
								success: true,
								action: 'downgraded',
								subscription: targetPlan
							});
						}
					});
				}
			});
		}
	}

	public getPlanPrice(plan: IPluginSubscriptionPlan): string {
		return this.planService.formatPlanPrice(plan);
	}

	public getPlanSavings(plan: IPluginSubscriptionPlan): string | null {
		return this.planService.calculatePlanSavings(plan);
	}

	public isCurrentPlan(plan: IPluginSubscriptionPlan): boolean {
		return this.currentSubscription?.planId === plan.id;
	}

	public canUpgrade(plan: IPluginSubscriptionPlan): boolean {
		if (!this.currentSubscription) return plan.type !== PluginSubscriptionType.FREE;
		const currentPlan = this.currentSubscription.plan;
		return currentPlan ? this.planService.canUpgrade(currentPlan, plan) : false;
	}

	public canDowngrade(plan: IPluginSubscriptionPlan): boolean {
		if (!this.currentSubscription) return false;
		const currentPlan = this.currentSubscription.plan;
		return currentPlan ? this.planService.canDowngrade(currentPlan, plan) : false;
	}

	public install(): void {
		this.actions.dispatch(PluginMarketplaceActions.install(this.plugin));
	}

	// Helper methods moved to services

	public close(): void {
		this.dialogRef.close({ success: false, action: 'closed' });
	}

	public getStatusIcon(status: string): string {
		return this.statusService.getStatusIcon(status);
	}
}
