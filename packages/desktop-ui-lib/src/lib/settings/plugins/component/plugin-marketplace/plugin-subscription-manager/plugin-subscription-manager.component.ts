import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
	IPlugin,
	IPluginSubscription,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginScope,
	PluginSubscriptionType
} from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, combineLatest } from 'rxjs';
import { filter, map, pairwise, shareReplay, startWith, take, tap } from 'rxjs/operators';
import { PluginInstallationQuery } from '../+state';
import { PluginMarketplaceActions } from '../+state/actions/plugin-marketplace.action';
import { PluginSubscriptionFacade } from '../+state/plugin-subscription.facade';
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
	public currentSubscription$: Observable<IPluginSubscription | null>;
	public selectedPlanViewModel: IPlanViewModel | null = null;
	public selectedPlan: IPluginSubscriptionPlan | null = null;
	public showBillingForm = false;
	public now = new Date();
	private currentResolvedPlan: IPluginSubscriptionPlan | null = null;

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

			// Current subscription stream (shared)
			this.currentSubscription$ = this.facade.getCurrentPluginSubscription(this.plugin.id).pipe(
				tap((subscription) => (this.currentSubscription = subscription)),
				shareReplay(1)
			);

			// Transform plans to view models
			this.planViewModels$ = this.availablePlans$.pipe(
				map((plans) => this.formatter.transformToViewModels(plans)),
				untilDestroyed(this)
			);

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
			return;
		}

		this.currentPlan$ = combineLatest([this.availablePlans$, this.currentSubscription$]).pipe(
			map(([plans, subscription]) => {
				this.currentSubscription = subscription;

				if (!subscription?.planId) {
					return null;
				}

				const foundPlan = plans.find((p) => p.id === subscription.planId) || null;

				return foundPlan;
			}),
			untilDestroyed(this)
		);

		// Subscribe to set the selectedPlan for use in non-template code
		this.currentPlan$.pipe(untilDestroyed(this)).subscribe((plan) => {
			this.selectedPlan = plan;
			this.currentResolvedPlan = plan;
		});
	}

	/**
	 * Handle plan selection with better UX feedback
	 * Validates the plan and shows appropriate forms or actions
	 */
	public onPlanSelected(planViewModel: IPlanViewModel): void {
		const plan = planViewModel.originalPlan;

		this.selectedPlanViewModel = planViewModel;
		this.selectedPlan = plan;
		this.subscriptionForm.patchValue({
			subscriptionType: plan.type,
			billingPeriod: plan.billingPeriod
		});

		// If it's the current plan, do nothing
		if (this.isCurrentPlan(plan)) {
			return;
		}

		// If subscription exists and upgrading/downgrading, show billing form
		if (this.currentSubscription) {
			if (this.canUpgrade(plan) || this.canDowngrade(plan)) {
				this.showBillingForm = true;
			}
			return;
		}

		// New subscription flow
		if (plan.type === PluginSubscriptionType.FREE) {
			this.subscribeToPlan();
		} else {
			this.showBillingForm = true;
		}
	}

	public subscribeToPlan(): void {
		if (!this.selectedPlan || !this.plugin?.id) return;

		if (this.selectedPlan.type !== PluginSubscriptionType.FREE && !this.subscriptionForm.valid) {
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

		this.facade.creating$
			.pipe(
				startWith(false),
				pairwise(),
				filter(([prev, curr]) => prev && !curr),
				take(1),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.facade.error$.pipe(take(1), untilDestroyed(this)).subscribe((error) => {
					if (!error) {
						this.dialogRef.close({
							success: true,
							action: 'subscribed',
							subscription: this.selectedPlan
						});
					}
				});
			});
	}

	public cancelSubscription(): void {
		if (!this.currentSubscription || !this.plugin?.id) return;

		// Improved confirmation message with better UX
		const confirmMessage = `Are you sure you want to cancel your subscription to "${this.plugin.name}"?
You will lose access to premium features at the end of your current billing period on ${
			this.currentSubscription.endDate
				? new Date(this.currentSubscription.endDate).toLocaleDateString()
				: 'the end of the current period'
		}.`;

		if (confirm(confirmMessage)) {
			this.facade.cancelSubscription(this.plugin.id, this.currentSubscription.id);

			this.facade.deleting$
				.pipe(
					startWith(false),
					pairwise(),
					filter(([prev, curr]) => prev && !curr),
					take(1),
					untilDestroyed(this)
				)
				.subscribe(() => {
					this.dialogRef.close({
						success: true,
						action: 'cancelled'
					});
				});
		}
	}

	public upgradeSubscription(plan?: IPluginSubscriptionPlan): void {
		const targetPlan = plan || this.selectedPlan;
		if (!targetPlan || !this.currentSubscription || !this.plugin?.id) return;

		const priceInfo = this.getPlanPrice(targetPlan);
		const confirmMessage = `Upgrade to ${targetPlan.name} for ${priceInfo}?
You'll be charged a prorated amount for the remainder of your current billing period.`;

		if (confirm(confirmMessage)) {
			// Update the subscription with new plan type and billing period
			this.facade.upgradeSubscription(this.plugin.id, this.currentSubscription.id, targetPlan.id);

			this.facade.updating$
				.pipe(
					startWith(false),
					pairwise(),
					filter(([prev, curr]) => prev && !curr),
					take(1),
					untilDestroyed(this)
				)
				.subscribe(() => {
					this.facade.error$.pipe(take(1), untilDestroyed(this)).subscribe((error) => {
						if (!error) {
							this.dialogRef.close({
								success: true,
								action: 'upgraded',
								subscription: targetPlan
							});
						}
					});
				});
		}
	}

	public downgradeSubscription(plan?: IPluginSubscriptionPlan): void {
		const targetPlan = plan || this.selectedPlan;
		if (!targetPlan || !this.currentSubscription || !this.plugin?.id) return;

		const priceInfo = this.getPlanPrice(targetPlan);
		const confirmMessage = `Downgrade to ${targetPlan.name} for ${priceInfo}?
This change will take effect at the end of your current billing period. You'll retain access to your current features until then.`;

		if (confirm(confirmMessage)) {
			// Update the subscription with new plan type and billing period
			this.facade.downgradeSubscription(this.plugin.id, this.currentSubscription.id, targetPlan.id);

			this.facade.updating$
				.pipe(
					startWith(false),
					pairwise(),
					filter(([prev, curr]) => prev && !curr),
					take(1),
					untilDestroyed(this)
				)
				.subscribe(() => {
					this.facade.error$.pipe(take(1), untilDestroyed(this)).subscribe((error) => {
						if (!error) {
							this.dialogRef.close({
								success: true,
								action: 'downgraded',
								subscription: targetPlan
							});
						}
					});
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
		const currentPlan = this.currentSubscription.plan ?? this.currentResolvedPlan;
		return currentPlan ? this.planService.canUpgrade(currentPlan, plan) : false;
	}

	public canDowngrade(plan: IPluginSubscriptionPlan): boolean {
		if (!this.currentSubscription) return false;
		const currentPlan = this.currentSubscription.plan ?? this.currentResolvedPlan;
		return currentPlan ? this.planService.canDowngrade(currentPlan, plan) : false;
	}

	public install(): void {
		this.actions.dispatch(PluginMarketplaceActions.install(this.plugin));
	}

	// Helper methods moved to services

	/**
	 * Check if subscription is in trial period
	 */
	public isInTrial(subscription: IPluginSubscription): boolean {
		if (!subscription) return false;
		return (
			subscription.status === 'trial' ||
			(subscription.trialEndDate && new Date(subscription.trialEndDate) > new Date())
		);
	}

	/**
	 * Check if subscription is expiring soon (within 7 days)
	 */
	public isExpiringSoon(subscription: IPluginSubscription): boolean {
		if (!subscription || !subscription.endDate) return false;
		const endDate = new Date(subscription.endDate).getTime();
		const now = new Date().getTime();
		const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
		return endDate - now < sevenDaysInMs && endDate - now > 0;
	}

	public close(): void {
		this.dialogRef.close({ success: false, action: 'closed' });
	}

	public getStatusIcon(status: string): string {
		return this.statusService.getStatusIcon(status);
	}
}
