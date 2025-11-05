import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	Observable,
	combineLatest,
	filter,
	firstValueFrom,
	map,
	of,
	startWith,
	switchMap,
	take,
	tap
} from 'rxjs';
import { PluginSubscriptionActions } from '../+state/actions/plugin-subscription.action';
import { PluginSubscriptionQuery } from '../+state/queries/plugin-subscription.query';
import { Store } from '../../../../../services';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionService,
	PluginSubscriptionType
} from '../../../services/plugin-subscription.service';
import { IPlanViewModel, ISubscriptionPreviewViewModel } from './models/plan-view.model';
import { PlanFormatterService } from './services/plan-formatter.service';

export interface IPluginSubscriptionSelectionContext {
	plugin: IPlugin;
	pluginId: string;
}

export interface IPluginSubscriptionSelectionResult {
	subscriptionPlan: IPluginSubscriptionPlan;
	subscriptionInput: IPluginSubscriptionCreateInput;
	proceedWithInstallation: boolean;
}

/**
 * Smart component for managing subscription plan selection
 * Follows SOLID principles:
 * - Single Responsibility: Coordinates subscription selection flow
 * - Open/Closed: Extensible through child components
 * - Liskov Substitution: Uses interfaces for dependencies
 * - Interface Segregation: Focused interfaces for each concern
 * - Dependency Inversion: Depends on abstractions (services, queries)
 */
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
	public selectedPlanViewModel$ = new BehaviorSubject<IPlanViewModel | null>(null);

	// View models for presentation
	public planViewModels$: Observable<IPlanViewModel[]>;
	public subscriptionPreview$: Observable<ISubscriptionPreviewViewModel | null>;

	// State management observables
	// IMPORTANT: These are SUBSCRIPTION PLANS (available options), not user subscriptions
	// Plans = What options are available to subscribe to (Free, Premium, Enterprise, etc.)
	// Subscriptions = What the user has actually subscribed to (managed elsewhere)
	public availablePlans$: Observable<IPluginSubscriptionPlan[]>;
	public loading$: Observable<boolean>;
	public creating$: Observable<boolean>;
	public updating$: Observable<boolean>;
	public error$: Observable<string | null>;

	// Current subscription state
	public currentSubscription$: Observable<IPluginSubscription | null>;
	public hasExistingSubscription$: Observable<boolean>;
	public currentPlanId$: Observable<string | null>;

	// Expose enums to template
	public readonly PluginSubscriptionType = PluginSubscriptionType;
	public readonly PluginBillingPeriod = PluginBillingPeriod;

	// Computed observables based on available PLANS
	public hasFreePlan$: Observable<boolean>;
	public hasPaidPlans$: Observable<boolean>;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginSubscriptionSelectionComponent>,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly formBuilder: FormBuilder,
		private readonly store: Store,
		private readonly pluginSubscriptionQuery: PluginSubscriptionQuery,
		private readonly actions$: Actions,
		private readonly planFormatter: PlanFormatterService
	) {
		this.initializeForm();
	}

	ngOnInit(): void {
		console.log('[PluginSubscriptionSelection] ngOnInit - Plugin data:', {
			plugin: this.plugin?.name,
			pluginId: this.pluginId,
			subscription: this.plugin?.subscription
		});

		// Initialize observables after @Input properties are set
		this.initializeObservables();
		this.loadSubscriptionPlans();
		this.initializeSubscriptionPreview();
		this.initializeCurrentSubscription();
	}

	ngOnDestroy(): void {
		this.selectedPlanViewModel$.complete();
	}

	private initializeObservables(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;

		if (!targetPluginId) {
			console.error('[PluginSubscriptionSelection] Cannot initialize observables: Plugin ID is required');
			return;
		}

		console.log('[PluginSubscriptionSelection] Initializing observables for plugin:', targetPluginId);

		// IMPORTANT: We're loading PLANS (available subscription options),
		// NOT SUBSCRIPTIONS (user's active subscriptions)
		// Plans = What the user CAN subscribe to
		// Subscriptions = What the user HAS subscribed to

		// Get available subscription PLANS from the query
		this.availablePlans$ = this.pluginSubscriptionQuery.getPlansForPlugin(targetPluginId!);
		this.loading$ = this.pluginSubscriptionQuery.loading$;
		this.creating$ = this.pluginSubscriptionQuery.creating$;
		this.error$ = this.pluginSubscriptionQuery.error$;

		// Transform subscription plans to view models using formatter service
		this.planViewModels$ = this.availablePlans$.pipe(
			tap((plans) =>
				console.log('[PluginSubscriptionSelection] Subscription PLANS before transformation:', plans)
			),
			map((plans) => this.planFormatter.transformToViewModels(plans)),
			tap((viewModels) =>
				console.log('[PluginSubscriptionSelection] Plan view models after transformation:', viewModels)
			)
		);

		// Computed observables based on available PLANS
		this.hasFreePlan$ = this.availablePlans$.pipe(
			map((plans) => plans.some((plan) => plan.type === PluginSubscriptionType.FREE))
		);

		this.hasPaidPlans$ = this.availablePlans$.pipe(
			map((plans) => plans.some((plan) => plan.type !== PluginSubscriptionType.FREE))
		);

		// Initialize updating state
		this.updating$ = this.pluginSubscriptionQuery.updating$;
	}

	/**
	 * Initialize current subscription state
	 * Checks for existing active subscription for this plugin
	 */
	private initializeCurrentSubscription(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;

		if (!targetPluginId) {
			console.warn('[PluginSubscriptionSelection] Cannot check current subscription: Plugin ID is required');
			this.currentSubscription$ = of(null);
			this.hasExistingSubscription$ = of(false);
			this.currentPlanId$ = of(null);
			return;
		}

		// Get current active subscription from the query
		this.currentSubscription$ = this.pluginSubscriptionQuery.getActiveSubscriptionForPlugin(targetPluginId);

		// Compute whether user has an existing subscription
		this.hasExistingSubscription$ = this.currentSubscription$.pipe(
			map((subscription) => !!subscription),
			tap((hasSubscription) => {
				console.log('[PluginSubscriptionSelection] Has existing subscription:', hasSubscription);
			})
		);

		// Extract current plan ID from subscription
		this.currentPlanId$ = this.currentSubscription$.pipe(
			map((subscription) => {
				// Try to get planId from metadata or subscription type
				const planId = subscription?.metadata?.planId;
				console.log('[PluginSubscriptionSelection] Current plan ID:', planId);
				return planId || null;
			})
		);

		// Watch for current subscription and log changes
		this.currentSubscription$
			.pipe(
				tap((subscription) => {
					if (subscription) {
						console.log('[PluginSubscriptionSelection] User has active subscription:', {
							id: subscription.id,
							type: subscription.subscriptionType,
							status: subscription.status,
							planId: subscription.metadata?.planId
						});
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initializeForm(): void {
		this.subscriptionForm = this.formBuilder.group({
			planId: ['', Validators.required],
			billingPeriod: [PluginBillingPeriod.MONTHLY],
			paymentMethodId: [''],
			promoCode: [''],
			agreeToTerms: [false, Validators.requiredTrue]
		});

		// React to plan selection using view models
		this.subscriptionForm
			.get('planId')
			?.valueChanges.pipe(
				switchMap((planId) =>
					this.planViewModels$.pipe(map((viewModels) => viewModels.find((vm) => vm.id === planId) || null))
				),
				tap((viewModel) => this.selectedPlanViewModel$.next(viewModel)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initializeSubscriptionPreview(): void {
		this.subscriptionPreview$ = combineLatest([
			this.selectedPlanViewModel$,
			this.subscriptionForm.valueChanges.pipe(startWith(this.subscriptionForm.value))
		]).pipe(
			map(([planViewModel, formValues]) => {
				if (!planViewModel) return null;

				const promoCode = (formValues as any).promoCode;
				// TODO: Calculate discount based on promo code validation
				const promoDiscount = 0;

				return this.planFormatter.createPreviewViewModel(planViewModel.originalPlan, promoDiscount);
			})
		);
	}

	private loadSubscriptionPlans(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;
		if (!targetPluginId) {
			console.error('[PluginSubscriptionSelection] Plugin ID is required');
			return;
		}

		console.log(
			'[PluginSubscriptionSelection] Loading subscription PLANS (not subscriptions) for plugin:',
			targetPluginId
		);

		// Dispatch action to load user's current SUBSCRIPTIONS for this plugin
		// This is needed to determine if user has an active subscription
		console.log('[PluginSubscriptionSelection] Loading user subscriptions for plugin:', targetPluginId);
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginSubscriptions(targetPluginId));

		// Dispatch action to load PLANS (available options to subscribe to)
		// This is different from loading SUBSCRIPTIONS (user's active subscriptions)
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginPlans(targetPluginId));

		// Watch for all plan updates (including empty arrays) for debugging
		this.availablePlans$
			.pipe(
				tap((plans) => {
					console.log(
						'[PluginSubscriptionSelection] Subscription PLANS received:',
						plans?.length || 0,
						plans
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// THEN watch for plan view models and auto-select free plan if available
		this.planViewModels$
			.pipe(
				tap((viewModels) => {
					console.log('[PluginSubscriptionSelection] Plan view models transformed:', viewModels?.length || 0);
					if (viewModels.length === 0) {
						console.warn(
							'[PluginSubscriptionSelection] No subscription plans available for plugin:',
							targetPluginId
						);
					}
				}),
				filter((viewModels) => viewModels.length > 0),
				tap((viewModels) => {
					const freePlan = viewModels.find((vm) => vm.isFree);
					if (freePlan && !this.subscriptionForm.value.planId) {
						console.log('[PluginSubscriptionSelection] Auto-selecting free plan:', freePlan.name);
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

	public onPlanSelected(planViewModel: IPlanViewModel): void {
		this.subscriptionForm.patchValue({
			planId: planViewModel.id,
			billingPeriod: planViewModel.billingPeriod
		});
	}

	public onBillingPeriodChange(period: PluginBillingPeriod): void {
		const currentPlanViewModel = this.selectedPlanViewModel$.value;
		if (!currentPlanViewModel) return;

		// Find if there's a plan with the same type but different billing period
		this.planViewModels$
			.pipe(
				map((viewModels) =>
					viewModels.find((vm) => vm.type === currentPlanViewModel.type && vm.billingPeriod === period)
				),
				filter((viewModel): viewModel is IPlanViewModel => viewModel !== undefined),
				tap((viewModel) => this.onPlanSelected(viewModel)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public async validatePromoCode(): Promise<void> {
		const promoCode = this.subscriptionForm.get('promoCode')?.value;
		if (!promoCode) return;

		try {
			const validation = await firstValueFrom(
				this.subscriptionService.validatePromoCode(promoCode, this.pluginId || this.plugin?.id)
			);

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

	public async onSubscribeAndInstall(): Promise<void> {
		if (!this.subscriptionForm.valid) {
			this.subscriptionForm.markAllAsTouched();
			console.log('[PluginSubscriptionSelection] Form validation failed');
			return;
		}

		const selectedPlanViewModel = this.selectedPlanViewModel$.value;
		if (!selectedPlanViewModel) {
			console.log('[PluginSubscriptionSelection] No plan selected');
			return;
		}

		// Check if user has existing subscription
		const currentSubscription = await firstValueFrom(this.currentSubscription$);
		const isUpgrade = !!currentSubscription;

		console.log('[PluginSubscriptionSelection] Subscription action:', {
			action: isUpgrade ? 'upgrade' : 'new',
			selectedPlan: selectedPlanViewModel.name,
			currentSubscription: currentSubscription?.subscriptionType
		});

		// Create a SUBSCRIPTION from the selected PLAN
		// Plan = The option the user chose (e.g., "Premium Plan")
		// Subscription = The actual user subscription that will be created or upgraded
		const subscriptionInput: IPluginSubscriptionCreateInput = {
			pluginId: this.pluginId || this.plugin?.id!,
			planId: selectedPlanViewModel.id, // Reference to the plan
			subscriptionType: selectedPlanViewModel.type,
			billingPeriod: this.subscriptionForm.value.billingPeriod,
			paymentMethodId: this.subscriptionForm.value.paymentMethodId,
			promoCode: this.subscriptionForm.value.promoCode,
			metadata: {
				source: 'plugin-marketplace',
				pluginName: this.plugin?.name,
				requiresSubscription: true,
				isUpgrade,
				previousSubscriptionId: currentSubscription?.id
			}
		};

		if (isUpgrade) {
			// User is upgrading/changing their existing subscription
			this.upgradeSubscription(currentSubscription!, selectedPlanViewModel.originalPlan, subscriptionInput);
		} else if (selectedPlanViewModel.isFree) {
			// For free plans, create subscription then proceed to installation
			console.log('[PluginSubscriptionSelection] Free plan selected, creating free subscription');
			this.createSubscription(selectedPlanViewModel.originalPlan, subscriptionInput);
		} else {
			// For paid plans, create subscription with payment validation
			console.log('[PluginSubscriptionSelection] Paid plan selected, creating paid subscription');
			this.createSubscription(selectedPlanViewModel.originalPlan, subscriptionInput);
		}
	}

	private createSubscription(plan: IPluginSubscriptionPlan, input: IPluginSubscriptionCreateInput): void {
		console.log('[PluginSubscriptionSelection] Creating SUBSCRIPTION from PLAN:', plan.name);
		console.log('[PluginSubscriptionSelection] Subscription input:', input);

		// Dispatch action to create a SUBSCRIPTION based on the selected PLAN
		// This will create a new subscription record for the user
		this.actions$.dispatch(PluginSubscriptionActions.createSubscription(input.pluginId, input));

		// Combine both observables to handle both success and error cases
		combineLatest([this.creating$, this.error$])
			.pipe(
				// Skip initial emissions
				filter(([creating, error]) => {
					// We're interested in state changes after dispatch
					return !creating || !!error;
				}),
				// Take only the first relevant emission
				take(1),
				tap(([creating, error]) => {
					if (error) {
						// Error case - subscription creation failed
						console.error('[PluginSubscriptionSelection] Failed to create subscription:', error);
						console.log('Failed to create subscription. Please try again.');
					} else if (!creating) {
						// Success case - subscription created successfully
						console.log(
							`[PluginSubscriptionSelection] Successfully created subscription to ${plan.name} plan for ${
								this.plugin?.name || 'plugin'
							}`
						);
						// Verify subscription was actually created before proceeding
						this.verifyAndProceed(plan, input);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Upgrade existing subscription to a new plan
	 * Handles upgrade/downgrade logic with proper state management
	 */
	private upgradeSubscription(
		currentSubscription: IPluginSubscription,
		newPlan: IPluginSubscriptionPlan,
		input: IPluginSubscriptionCreateInput
	): void {
		console.log('[PluginSubscriptionSelection] Upgrading SUBSCRIPTION:', {
			from: currentSubscription.subscriptionType,
			to: newPlan.type,
			currentSubscriptionId: currentSubscription.id,
			newPlanId: newPlan.id
		});

		const pluginId = this.pluginId || this.plugin?.id!;

		// Determine if this is an upgrade or downgrade
		const isUpgrade = this.isPlanUpgrade(currentSubscription.subscriptionType, newPlan.type);

		if (isUpgrade) {
			console.log('[PluginSubscriptionSelection] Dispatching upgrade action');
			this.actions$.dispatch(
				PluginSubscriptionActions.upgradeSubscription(pluginId, currentSubscription.id, newPlan.id)
			);
		} else {
			console.log('[PluginSubscriptionSelection] Dispatching downgrade action');
			this.actions$.dispatch(
				PluginSubscriptionActions.downgradeSubscription(pluginId, currentSubscription.id, newPlan.id)
			);
		}

		// Watch for upgrade/downgrade completion
		combineLatest([this.updating$, this.error$])
			.pipe(
				filter(([updating, error]) => !updating || !!error),
				take(1),
				tap(([updating, error]) => {
					if (error) {
						console.error('[PluginSubscriptionSelection] Failed to upgrade subscription:', error);
						console.log('Failed to upgrade subscription. Please try again.');
					} else if (!updating) {
						console.log('[PluginSubscriptionSelection] Successfully upgraded subscription');
						// Close dialog and proceed with installation
						this.proceedWithInstallation(newPlan, input);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Determine if the plan change is an upgrade
	 * Order: FREE < TRIAL < BASIC < PREMIUM < ENTERPRISE < CUSTOM
	 */
	private isPlanUpgrade(currentType: PluginSubscriptionType, newType: PluginSubscriptionType): boolean {
		const planHierarchy = {
			[PluginSubscriptionType.FREE]: 0,
			[PluginSubscriptionType.TRIAL]: 1,
			[PluginSubscriptionType.BASIC]: 2,
			[PluginSubscriptionType.PREMIUM]: 3,
			[PluginSubscriptionType.ENTERPRISE]: 4,
			[PluginSubscriptionType.CUSTOM]: 5
		};

		return planHierarchy[newType] > planHierarchy[currentType];
	}

	/**
	 * Verify subscription was successfully created before allowing installation
	 * This ensures the backend has properly recorded the subscription
	 */
	private verifyAndProceed(plan: IPluginSubscriptionPlan, input: IPluginSubscriptionCreateInput): void {
		// Get the selected subscription from the query state
		const createdSubscription = this.pluginSubscriptionQuery.selectedSubscription;

		if (createdSubscription && createdSubscription.status) {
			// Subscription exists and has a valid status
			console.log('[PluginSubscriptionSelection] Subscription verified, proceeding with installation');
			this.proceedWithInstallation(plan, input);
		} else {
			// Subscription state is invalid or missing - check if subscription was added to collection
			console.warn('[PluginSubscriptionSelection] No selected subscription, checking subscriptions list');

			// Try to find a recently created subscription for this plugin
			const subscriptions = this.pluginSubscriptionQuery.subscriptions;
			const recentSubscription = subscriptions.find(
				(s) => s.pluginId === input.pluginId && s.subscriptionType === input.subscriptionType
			);

			if (recentSubscription) {
				console.log(
					'[PluginSubscriptionSelection] Found subscription in collection, proceeding with installation'
				);
				this.proceedWithInstallation(plan, input);
			} else {
				console.error(
					'[PluginSubscriptionSelection] Subscription verification failed - no valid subscription found'
				);
				console.log('Subscription could not be verified. Please try again or contact support.');
			}
		}
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

	/**
	 * Reset the subscription process after a failure
	 * Clears error state and allows user to try again
	 */
	public onResetSubscription(): void {
		console.log('[PluginSubscriptionSelection] Resetting subscription process');
		// Keep the selected plan but reset other fields
		this.subscriptionForm.patchValue({
			paymentMethodId: '',
			promoCode: '',
			agreeToTerms: false
		});

		// Clear any error state in the store
		this.actions$.dispatch(PluginSubscriptionActions.resetError());

		// Keep the selected plan but allow user to modify their choices
		console.log('[PluginSubscriptionSelection] Subscription process reset, ready to try again');
	}

	// Computed properties for template
	public async canProceedWithoutSubscription(): Promise<boolean> {
		// Allow skipping subscription if there are free plans or if it's optional
		const hasFreePlans = await firstValueFrom(this.hasFreePlan$);
		// Check if plugin type allows free installation
		return hasFreePlans || !this.plugin.hasPlan;
	}

	/**
	 * Format billing period for display in the UI
	 */
	public formatBillingPeriod(period: PluginBillingPeriod): string {
		switch (period) {
			case PluginBillingPeriod.DAILY:
				return 'Daily';
			case PluginBillingPeriod.WEEKLY:
				return 'Weekly';
			case PluginBillingPeriod.MONTHLY:
				return 'Monthly';
			case PluginBillingPeriod.QUARTERLY:
				return 'Quarterly';
			case PluginBillingPeriod.YEARLY:
				return 'Yearly';
			case PluginBillingPeriod.ONE_TIME:
				return 'One-Time';
			default:
				return 'Unknown';
		}
	}

	/**
	 * Check if a plan is the user's current subscription plan
	 * Used to highlight and disable the current plan
	 */
	public async isCurrentPlan(planId: string): Promise<boolean> {
		const currentPlanId = await firstValueFrom(this.currentPlanId$);
		return currentPlanId === planId;
	}

	/**
	 * Get the action button text based on subscription state
	 * Returns "Current Plan", "Upgrade", "Downgrade", or "Subscribe & Install"
	 */
	public async getActionButtonText(planType: PluginSubscriptionType): Promise<string> {
		const currentSubscription = await firstValueFrom(this.currentSubscription$);

		if (!currentSubscription) {
			return 'Subscribe & Install';
		}

		const currentType = currentSubscription.subscriptionType;

		// Check if it's the same plan
		if (currentType === planType) {
			return 'Current Plan';
		}

		// Check if it's an upgrade or downgrade
		const isUpgrade = this.isPlanUpgrade(currentType, planType);
		return isUpgrade ? 'Upgrade' : 'Downgrade';
	}

	/**
	 * Check if the plan should be disabled (i.e., it's the current plan)
	 */
	public async isPlanDisabled(planType: PluginSubscriptionType): Promise<boolean> {
		const currentSubscription = await firstValueFrom(this.currentSubscription$);
		if (!currentSubscription) {
			return false;
		}
		return currentSubscription.subscriptionType === planType;
	}
}
