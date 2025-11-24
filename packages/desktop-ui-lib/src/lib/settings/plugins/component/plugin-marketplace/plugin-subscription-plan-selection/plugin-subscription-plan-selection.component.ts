import { ChangeDetectionStrategy, Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin, PluginScope } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	combineLatest,
	filter,
	firstValueFrom,
	map,
	Observable,
	startWith,
	switchMap,
	take,
	tap
} from 'rxjs';
import { PluginSubscriptionFacade } from '../+state';
import { PluginSubscriptionActions } from '../+state/actions/plugin-subscription.action';
import { PluginSubscriptionQuery } from '../+state/queries/plugin-subscription.query';
import {
	IPluginSubscription,
	IPluginSubscriptionCreateInput,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionService,
	PluginSubscriptionType
} from '../../../services/plugin-subscription.service';
import { SubscriptionFormService, SubscriptionPlanService, SubscriptionStatusService } from '../shared';
import { IPlanViewModel, ISubscriptionPreviewViewModel } from './models/plan-view.model';
import { IPlanComparisonResult, PlanActionType, PlanComparisonService } from './services/plan-comparison.service';
import { PlanFormatterService } from './services/plan-formatter.service';

export interface IPluginSubscriptionPlanSelectionContext {
	plugin: IPlugin;
	pluginId: string;
}

export interface IPluginSubscriptionPlanSelectionResult {
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
	selector: 'lib-plugin-subscription-plan-selection',
	templateUrl: './plugin-subscription-plan-selection.component.html',
	styleUrls: ['./plugin-subscription-plan-selection.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginSubscriptionPlanSelectionComponent implements OnInit, OnDestroy {
	@Input() plugin: IPlugin;
	@Input() pluginId: string;

	public subscriptionForm: FormGroup;
	public selectedPlanViewModel$ = new BehaviorSubject<IPlanViewModel | null>(null);
	public planComparisonResult$ = new BehaviorSubject<IPlanComparisonResult | null>(null);

	// UX enhancement properties
	public validatingPromo: boolean = false;
	public promoCodeStatus: { valid: boolean; message: string } | null = null;
	public showComparisonView: boolean = false;
	public formDirty: boolean = false;
	public showKeyboardHints: boolean = false;

	// View models for presentation
	public planViewModels$: Observable<IPlanViewModel[]>;
	public subscriptionPreview$: Observable<ISubscriptionPreviewViewModel | null>;

	// State management observables using facade
	public availablePlans$: Observable<IPluginSubscriptionPlan[]>;
	public loading$: Observable<boolean>;
	public creating$: Observable<boolean>;
	public updating$: Observable<boolean>;
	public error$: Observable<string | null>;

	// Current subscription state with tracking
	public currentSubscription$: Observable<IPluginSubscription | null>;
	public hasExistingSubscription$: Observable<boolean>;
	public currentPlanId$: Observable<string | null>;
	public pluginSubscriptionStatus$: Observable<{
		hasSubscription: boolean;
		isActive: boolean;
		isTrial: boolean;
		isExpired: boolean;
		currentPlanType: PluginSubscriptionType | null;
		daysRemaining?: number;
	}>;

	// Plan comparison state
	public planComparison$: Observable<{
		currentPlan: IPluginSubscriptionPlan | null;
		selectedPlan: IPluginSubscriptionPlan | null;
		actionType: PlanActionType;
		isValidAction: boolean;
		requiresPayment: boolean;
		prorationAmount?: number;
	}>;

	// Expose enums to template
	public readonly PluginSubscriptionType = PluginSubscriptionType;
	public readonly PluginBillingPeriod = PluginBillingPeriod;
	public readonly PluginScope = PluginScope;

	// Computed observables based on available PLANS
	public hasFreePlan$: Observable<boolean>;
	public hasPaidPlans$: Observable<boolean>;

	private readonly formBuilder = inject(FormBuilder);

	constructor(
		private readonly dialogRef: NbDialogRef<PluginSubscriptionPlanSelectionComponent>,
		private readonly subscriptionService: PluginSubscriptionService,
		private readonly pluginSubscriptionQuery: PluginSubscriptionQuery,
		private readonly actions$: Actions,
		private readonly planFormatter: PlanFormatterService,
		private readonly facade: PluginSubscriptionFacade,
		private readonly planComparison: PlanComparisonService,
		public readonly planService: SubscriptionPlanService,
		private readonly formService: SubscriptionFormService,
		public readonly statusService: SubscriptionStatusService
	) {
		this.initializeForm();
		this.setupKeyboardShortcuts();
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
	}

	ngOnDestroy(): void {
		this.selectedPlanViewModel$.complete();
		this.planComparisonResult$.complete();

		// Clean up keyboard event listener
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', this.handleKeyboardShortcut.bind(this));
		}
	}

	private initializeObservables(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;

		if (!targetPluginId) {
			console.error('[PluginSubscriptionSelection] Cannot initialize observables: Plugin ID is required');
			return;
		}

		console.log('[PluginSubscriptionSelection] Initializing observables for plugin:', targetPluginId);

		// Use facade for state management
		this.availablePlans$ = this.facade.getCurrentPluginPlans(targetPluginId);
		this.loading$ = this.facade.loading$;
		this.creating$ = this.facade.creating$;
		this.updating$ = this.facade.updating$;
		this.error$ = this.facade.error$;

		// Subscription status tracking
		this.currentSubscription$ = this.facade.getCurrentPluginSubscription(targetPluginId);
		this.pluginSubscriptionStatus$ = this.facade.getPluginSubscriptionStatus(targetPluginId);
		this.planComparison$ = this.facade.getPlanComparisonForPlugin(targetPluginId);

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

		// Computed observables
		this.hasExistingSubscription$ = this.pluginSubscriptionStatus$.pipe(map((status) => status.hasSubscription));

		this.currentPlanId$ = this.planComparison$.pipe(map((comparison) => comparison.currentPlan?.id || null));

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
			scope: [null, Validators.required], // Will be set automatically based on plan type
			autoRenew: [true],
			agreeToTerms: [false, Validators.requiredTrue]
		});

		// React to plan selection using plan comparison
		this.subscriptionForm
			.get('planId')
			?.valueChanges.pipe(
				filter((planId) => !!planId),
				switchMap((planId) =>
					combineLatest([
						this.planViewModels$.pipe(
							map((vms) => vms.find((vm) => vm.id === planId) || null),
							filter((vm): vm is IPlanViewModel => vm !== null)
						),
						this.currentSubscription$
					])
				),
				tap(([planViewModel, currentSubscription]) => {
					// Update selected plan view model
					this.selectedPlanViewModel$.next(planViewModel);

					// Automatically determine and set scope based on plan type
					const determinedScope = this.determineScope(planViewModel.type);
					this.subscriptionForm.patchValue({ scope: determinedScope }, { emitEvent: false });

					// Perform plan comparison
					const comparisonResult = this.planComparison.comparePlans(
						currentSubscription,
						planViewModel.originalPlan
					);

					this.planComparisonResult$.next(comparisonResult);

					// Update facade with comparison state
					const targetPluginId = this.pluginId || this.plugin?.id;
					if (targetPluginId) {
						this.facade.updatePlanComparison(
							currentSubscription?.planId || null,
							planViewModel.id,
							comparisonResult.actionType,
							comparisonResult.isValidAction,
							comparisonResult.requiresPayment,
							comparisonResult.prorationAmount
						);
					}

					console.log('[PluginSubscriptionSelection] Plan comparison result:', comparisonResult);
					console.log('[PluginSubscriptionSelection] Auto-determined scope:', determinedScope);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Clear selected plan when form is reset
		this.subscriptionForm
			.get('planId')
			?.valueChanges.pipe(
				filter((planId) => !planId),
				tap(() => {
					this.selectedPlanViewModel$.next(null);
					this.planComparisonResult$.next(null);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Track form changes for dirty state
		this.subscriptionForm.valueChanges
			.pipe(
				tap(() => {
					this.formDirty = true;
				}),
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

		console.log('[PluginSubscriptionSelection] Loading subscription data for plugin:', targetPluginId);

		// Load both subscriptions and plans using facade
		this.facade.loadPluginSubscriptions(targetPluginId);
		this.facade.loadPluginPlans(targetPluginId);

		// Watch for plan updates and auto-select appropriate plan
		combineLatest([
			this.planViewModels$.pipe(
				filter((viewModels) => viewModels.length > 0),
				tap((viewModels) => {
					console.log('[PluginSubscriptionSelection] Plan view models loaded:', viewModels.length);
				})
			),
			this.currentSubscription$,
			this.subscriptionForm.get('planId')!.valueChanges.pipe(startWith(null))
		])
			.pipe(
				filter(
					([viewModels, currentSubscription, currentFormValue]) => !currentFormValue && viewModels.length > 0
				),
				map(([viewModels, currentSubscription]) => {
					// Auto-select logic based on subscription status
					if (currentSubscription?.planId) {
						// User has existing subscription - select current plan by ID
						const currentPlan = viewModels.find((vm) => vm.id === currentSubscription.planId);
						if (currentPlan) {
							console.log(
								'[PluginSubscriptionSelection] Auto-selecting current plan by ID:',
								currentPlan.name
							);
							return currentPlan;
						}
					}

					// No existing subscription - auto-select free plan if available
					const freePlan = viewModels.find((vm) => vm.isFree);
					if (freePlan) {
						console.log('[PluginSubscriptionSelection] Auto-selecting free plan:', freePlan.name);
						return freePlan;
					}

					return null;
				}),
				filter((planToSelect): planToSelect is IPlanViewModel => planToSelect !== null),
				take(1), // Only auto-select once
				tap((planToSelect) => {
					this.subscriptionForm.patchValue({
						planId: planToSelect.id,
						billingPeriod: planToSelect.billingPeriod
					});
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
				take(1), // Complete after finding the plan
				untilDestroyed(this)
			)
			.subscribe((viewModel) => this.onPlanSelected(viewModel));
	}

	/**
	 * Automatically determine the appropriate scope based on plan type
	 * Following the business logic from backend:
	 * - FREE plans: Always USER scope
	 * - TRIAL plans: Always USER scope
	 * - Paid plans (BASIC, PREMIUM, ENTERPRISE, CUSTOM): Default to USER scope
	 */
	private determineScope(planType: PluginSubscriptionType): PluginScope {
		switch (planType) {
			case PluginSubscriptionType.FREE:
			case PluginSubscriptionType.TRIAL:
				return PluginScope.USER;
			case PluginSubscriptionType.BASIC:
			case PluginSubscriptionType.PREMIUM:
				return PluginScope.ORGANIZATION;
			case PluginSubscriptionType.ENTERPRISE:
			case PluginSubscriptionType.CUSTOM:
				return PluginScope.TENANT;
			default:
				return PluginScope.USER;
		}
	}

	public async validatePromoCode(): Promise<void> {
		const promoCode = this.subscriptionForm.get('promoCode')?.value;
		if (!promoCode) {
			this.promoCodeStatus = null;
			return;
		}

		this.validatingPromo = true;
		this.promoCodeStatus = null;

		try {
			const validation = await firstValueFrom(
				this.subscriptionService.validatePromoCode(promoCode, this.pluginId || this.plugin?.id)
			);

			if (validation?.valid) {
				console.log('Promo code applied successfully');
				this.promoCodeStatus = {
					valid: true,
					message: `Promo code applied! You save ${validation.discount || 0}%`
				};
				// Update the preview with discount will happen automatically through observables
			} else {
				console.log('Invalid promo code');
				this.promoCodeStatus = {
					valid: false,
					message: 'This promo code is invalid or has expired'
				};
			}
		} catch (error) {
			console.error('Failed to validate promo code:', error);
			this.promoCodeStatus = {
				valid: false,
				message: 'Unable to validate promo code. Please try again.'
			};
		} finally {
			this.validatingPromo = false;
		}
	}

	public async onSubscribeAndInstall(): Promise<void> {
		if (!this.subscriptionForm.valid) {
			this.subscriptionForm.markAllAsTouched();
			console.log('[PluginSubscriptionSelection] Form validation failed');
			return;
		}

		const selectedPlanViewModel = this.selectedPlanViewModel$.value;
		const comparisonResult = this.planComparisonResult$.value;

		if (!selectedPlanViewModel || !comparisonResult) {
			console.log('[PluginSubscriptionSelection] No plan selected or comparison result missing');
			return;
		}

		// Check if action is valid
		if (!comparisonResult.canProceed) {
			console.log('[PluginSubscriptionSelection] Action not allowed:', comparisonResult.restrictions);
			return;
		}

		// Show confirmation for downgrades with restrictions
		if (comparisonResult.actionType === 'downgrade' && comparisonResult.restrictions.length > 0) {
			const confirmed = await this.confirmDowngrade(comparisonResult.restrictions);
			if (!confirmed) {
				console.log('[PluginSubscriptionSelection] User cancelled downgrade');
				return;
			}
		}

		// Get current subscription status
		const currentSubscription = await firstValueFrom(this.currentSubscription$);
		const isUpgrade = comparisonResult.actionType === 'upgrade';
		const isDowngrade = comparisonResult.actionType === 'downgrade';
		const isNew = comparisonResult.actionType === 'new';

		console.log('[PluginSubscriptionSelection] Subscription action:', {
			action: comparisonResult.actionType,
			selectedPlan: selectedPlanViewModel.name,
			currentSubscription: currentSubscription?.subscriptionType,
			requiresPayment: comparisonResult.requiresPayment,
			prorationAmount: comparisonResult.prorationAmount
		});

		// Create subscription input
		const subscriptionInput: IPluginSubscriptionCreateInput = {
			pluginId: this.pluginId || this.plugin?.id!,
			planId: selectedPlanViewModel.id,
			scope: this.subscriptionForm.value.scope,
			autoRenew: this.subscriptionForm.value.autoRenew,
			paymentMethodId: this.subscriptionForm.value.paymentMethodId,
			promoCode: this.subscriptionForm.value.promoCode,
			metadata: {
				source: 'plugin-marketplace',
				pluginName: this.plugin?.name,
				requiresSubscription: true,
				actionType: comparisonResult.actionType,
				previousSubscriptionId: currentSubscription?.id,
				prorationAmount: comparisonResult.prorationAmount,
				billingPeriod: this.subscriptionForm.value.billingPeriod,
				requestedScope: this.subscriptionForm.value.scope
			}
		};

		// Set confirmation step
		this.facade.setConfirmationStep('processing');

		if (isUpgrade) {
			// User is upgrading their existing subscription
			this.upgradeSubscription(currentSubscription!, selectedPlanViewModel.originalPlan, subscriptionInput);
		} else if (isDowngrade) {
			// User is downgrading their existing subscription
			this.downgradeSubscription(currentSubscription!, selectedPlanViewModel.originalPlan, subscriptionInput);
		} else if (isNew) {
			// New subscription
			if (selectedPlanViewModel.isFree) {
				console.log('[PluginSubscriptionSelection] Free plan selected, creating free subscription');
				this.createSubscription(selectedPlanViewModel.originalPlan, subscriptionInput);
			} else {
				console.log('[PluginSubscriptionSelection] Paid plan selected, creating paid subscription');
				this.createSubscription(selectedPlanViewModel.originalPlan, subscriptionInput);
			}
		}
	}

	private createSubscription(plan: IPluginSubscriptionPlan, input: IPluginSubscriptionCreateInput): void {
		console.log('[PluginSubscriptionSelection] Creating SUBSCRIPTION from PLAN:', plan.name);
		console.log('[PluginSubscriptionSelection] Subscription input:', input);

		// Dispatch action to create a SUBSCRIPTION based on the selected PLAN
		this.actions$.dispatch(PluginSubscriptionActions.createSubscription(input.pluginId, input));

		// Watch for creation completion
		combineLatest([this.creating$, this.error$])
			.pipe(
				filter(([creating, error]) => !creating || !!error),
				take(1),
				untilDestroyed(this)
			)
			.subscribe(([creating, error]) => {
				if (error) {
					console.error('[PluginSubscriptionSelection] Failed to create subscription:', error);
					this.facade.setConfirmationStep('selection');
				} else if (!creating) {
					console.log(`[PluginSubscriptionSelection] Successfully created subscription to ${plan.name}`);
					this.facade.setConfirmationStep('completed');
					this.proceedWithInstallation(plan, input);
				}
			});
	}

	/**
	 * Upgrade existing subscription to a new plan using facade
	 */
	private upgradeSubscription(
		currentSubscription: IPluginSubscription,
		newPlan: IPluginSubscriptionPlan,
		input: IPluginSubscriptionCreateInput
	): void {
		console.log('[PluginSubscriptionSelection] Upgrading SUBSCRIPTION using facade:', {
			from: currentSubscription.subscriptionType,
			to: newPlan.type,
			currentSubscriptionId: currentSubscription.id,
			newPlanId: newPlan.id
		});

		const pluginId = this.pluginId || this.plugin?.id!;
		this.facade.upgradeSubscription(pluginId, currentSubscription.id, newPlan.id);

		// Watch for upgrade completion
		combineLatest([this.updating$, this.error$])
			.pipe(
				filter(([updating, error]) => !updating || !!error),
				take(1),
				tap(([updating, error]) => {
					if (error) {
						console.error('[PluginSubscriptionSelection] Upgrade failed:', error);
						this.facade.setConfirmationStep('selection'); // Reset to selection
					} else if (!updating) {
						console.log('[PluginSubscriptionSelection] Upgrade completed successfully');
						this.facade.setConfirmationStep('completed');
						this.proceedWithInstallation(newPlan, input);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Downgrade existing subscription to a new plan using facade
	 */
	private downgradeSubscription(
		currentSubscription: IPluginSubscription,
		newPlan: IPluginSubscriptionPlan,
		input: IPluginSubscriptionCreateInput
	): void {
		console.log('[PluginSubscriptionSelection] Downgrading SUBSCRIPTION using facade:', {
			from: currentSubscription.subscriptionType,
			to: newPlan.type,
			currentSubscriptionId: currentSubscription.id,
			newPlanId: newPlan.id
		});

		const pluginId = this.pluginId || this.plugin?.id!;
		this.facade.downgradeSubscription(pluginId, currentSubscription.id, newPlan.id);

		// Watch for downgrade completion
		combineLatest([this.updating$, this.error$])
			.pipe(
				filter(([updating, error]) => !updating || !!error),
				take(1),
				tap(([updating, error]) => {
					if (error) {
						console.error('[PluginSubscriptionSelection] Downgrade failed:', error);
						this.facade.setConfirmationStep('selection'); // Reset to selection
					} else if (!updating) {
						console.log('[PluginSubscriptionSelection] Downgrade completed successfully');
						this.facade.setConfirmationStep('completed');
						this.proceedWithInstallation(newPlan, input);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private proceedWithInstallation(plan: IPluginSubscriptionPlan, input: IPluginSubscriptionCreateInput): void {
		const result: IPluginSubscriptionPlanSelectionResult = {
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
		const result: IPluginSubscriptionPlanSelectionResult = {
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
	public get canProceedWithoutSubscription$(): Observable<boolean> {
		return this.hasFreePlan$.pipe(map((hasFreePlans) => hasFreePlans || !this.plugin?.hasPlan));
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
	 * Get the action button text based on current plan comparison result
	 */
	public getActionButtonText(): Observable<string> {
		return this.planComparisonResult$.pipe(
			map((result) => {
				if (!result) return 'Select Plan';
				return this.planComparison.getActionDescription(result, '');
			})
		);
	}

	/**
	 * Get action button text for a specific plan type
	 */
	public getActionButtonTextForPlan(planViewModel: IPlanViewModel): Observable<string> {
		return this.currentSubscription$.pipe(
			map((currentSubscription) => {
				const comparisonResult = this.planComparison.comparePlans(
					currentSubscription,
					planViewModel.originalPlan
				);
				return this.planComparison.getActionDescription(comparisonResult, planViewModel.name);
			})
		);
	}

	/**
	 * Check if the plan should be disabled based on comparison result
	 */
	public isPlanDisabled(planViewModel: IPlanViewModel): Observable<boolean> {
		return this.currentSubscription$.pipe(
			map((currentSubscription) => {
				const comparisonResult = this.planComparison.comparePlans(
					currentSubscription,
					planViewModel.originalPlan
				);
				return this.planComparison.isPlanSelectionDisabled(comparisonResult);
			})
		);
	}

	/**
	 * Get the button variant for a specific plan
	 */
	public getActionButtonVariant(
		planViewModel: IPlanViewModel
	): Observable<'primary' | 'success' | 'warning' | 'basic'> {
		return this.currentSubscription$.pipe(
			map((currentSubscription) => {
				const comparisonResult = this.planComparison.comparePlans(
					currentSubscription,
					planViewModel.originalPlan
				);
				return this.planComparison.getActionButtonVariant(comparisonResult);
			})
		);
	}

	/**
	 * Show confirmation dialog for downgrades with feature loss warnings
	 */
	private async confirmDowngrade(restrictions: string[]): Promise<boolean> {
		return new Promise((resolve) => {
			// In a real implementation, this would open a NbDialog with proper confirmation UI
			// For now, using browser confirm as fallback
			const message = [
				'Are you sure you want to downgrade?',
				'',
				'You will lose access to:',
				...restrictions.map((r) => `• ${r}`),
				'',
				'The downgrade will take effect at the end of your current billing cycle.'
			].join('\n');

			const confirmed = confirm(message);
			resolve(confirmed);
		});
	}

	/**
	 * Determine if the plan change is an upgrade
	 * Order: FREE < TRIAL < BASIC < PREMIUM < ENTERPRISE < CUSTOM
	 */
	public isPlanUpgrade(currentType: PluginSubscriptionType, newType: PluginSubscriptionType): boolean {
		return this.planService.comparePlans(currentType, newType) === 'upgrade';
	}

	/**
	 * Generate accessible ARIA label for plan cards with context
	 */
	public getPlanAriaLabel(plan: IPlanViewModel, currentSubscription: IPluginSubscription | null): string {
		if (!currentSubscription) {
			return `Select ${plan.name} plan for ${plan.formattedPrice} per ${plan.formattedBillingPeriod}`;
		}

		if (currentSubscription.subscriptionType === plan.type) {
			return `${plan.name} plan - Your current active plan`;
		}

		const isUpgrade = this.isPlanUpgrade(currentSubscription.subscriptionType, plan.type);
		const action = isUpgrade ? 'Upgrade' : 'Downgrade';
		return `${action} to ${plan.name} plan for ${plan.formattedPrice} per ${plan.formattedBillingPeriod}`;
	}

	/**
	 * Setup keyboard shortcuts for better UX
	 * Escape - Close dialog
	 * Ctrl/Cmd + Enter - Submit form (if valid)
	 */
	private setupKeyboardShortcuts(): void {
		// Using HostListener would be better, but adding via constructor for now
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', this.handleKeyboardShortcut.bind(this));
		}
	}

	private handleKeyboardShortcut(event: KeyboardEvent): void {
		// Escape key - Close dialog
		if (event.key === 'Escape') {
			this.onCancel();
			return;
		}

		// Ctrl/Cmd + Enter - Submit form
		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			if (this.subscriptionForm.valid) {
				event.preventDefault();
				this.onSubscribeAndInstall();
			}
		}

		// Question mark - Toggle keyboard hints
		if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
			const target = event.target as HTMLElement;
			// Only toggle if not in input field
			if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
				event.preventDefault();
				this.showKeyboardHints = !this.showKeyboardHints;
			}
		}
	}

	/**
	 * Get contextual validation message for form fields
	 */
	public getValidationMessage(fieldName: string): string {
		const control = this.subscriptionForm.get(fieldName);
		if (!control || !control.errors || !control.touched) {
			return '';
		}

		switch (fieldName) {
			case 'planId':
				if (control.errors['required']) {
					return 'Please select a subscription plan to continue';
				}
				break;
			case 'agreeToTerms':
				if (control.errors['required']) {
					return 'You must accept the terms and conditions to proceed';
				}
				break;
			case 'paymentMethodId':
				if (control.errors['required']) {
					return 'Please select a payment method for paid plans';
				}
				break;
			case 'promoCode':
				if (control.errors['invalid']) {
					return 'This promo code is invalid or has expired';
				}
				break;
		}

		return 'This field is required';
	}

	/**
	 * Toggle comparison view for plan features
	 */
	public toggleComparisonView(): void {
		this.showComparisonView = !this.showComparisonView;
	}

	/**
	 * Calculate savings for yearly vs monthly billing
	 */
	public calculateYearlySavings(
		planViewModel: IPlanViewModel
	): Observable<{ amount: number; percentage: number } | null> {
		return this.planViewModels$.pipe(
			map((viewModels) => {
				// Find monthly version of the same plan type
				const monthlyPlan = viewModels.find(
					(vm) => vm.type === planViewModel.type && vm.billingPeriod === PluginBillingPeriod.MONTHLY
				);

				// Find yearly version of the same plan type
				const yearlyPlan = viewModels.find(
					(vm) => vm.type === planViewModel.type && vm.billingPeriod === PluginBillingPeriod.YEARLY
				);

				if (!monthlyPlan || !yearlyPlan) {
					return null;
				}

				const monthlyYearlyCost = monthlyPlan.price * 12;
				const yearlyActualCost = yearlyPlan.price;
				const savings = monthlyYearlyCost - yearlyActualCost;
				const percentage = Math.round((savings / monthlyYearlyCost) * 100);

				return {
					amount: savings,
					percentage: percentage
				};
			})
		);
	}

	/**
	 * Get descriptive loading message based on current operation
	 */
	public getLoadingMessage(): Observable<string> {
		return combineLatest([this.loading$, this.creating$, this.updating$]).pipe(
			map(([loading, creating, updating]) => {
				if (creating) return 'Creating your subscription...';
				if (updating) return 'Updating your subscription...';
				if (loading) return 'Loading available plans...';
				return '';
			})
		);
	}
}
