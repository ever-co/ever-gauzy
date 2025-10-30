import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, combineLatest, filter, map, startWith, switchMap, tap } from 'rxjs';
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
		this.initializeObservables();
	}

	ngOnInit(): void {
		this.loadSubscriptionPlans();
		this.initializeSubscriptionPreview();
	}

	ngOnDestroy(): void {
		this.selectedPlanViewModel$.complete();
	}

	private initializeObservables(): void {
		const targetPluginId = this.pluginId || this.plugin?.id;

		// Use state management observables
		this.availablePlans$ = this.pluginSubscriptionQuery.getPlansForPlugin(targetPluginId!);
		this.loading$ = this.pluginSubscriptionQuery.loading$;
		this.creating$ = this.pluginSubscriptionQuery.creating$;
		this.error$ = this.pluginSubscriptionQuery.error$;

		// Transform plans to view models using formatter service
		this.planViewModels$ = this.availablePlans$.pipe(
			map((plans) => this.planFormatter.transformToViewModels(plans))
		);

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
			console.error('Plugin ID is required');
			return;
		}

		// Dispatch action to load plans
		this.actions$.dispatch(PluginSubscriptionActions.loadPluginPlans(targetPluginId));

		// Watch for plan view models and auto-select free plan if available
		this.planViewModels$
			.pipe(
				filter((viewModels) => viewModels.length > 0),
				tap((viewModels) => {
					const freePlan = viewModels.find((vm) => vm.isFree);
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

		const selectedPlanViewModel = this.selectedPlanViewModel$.value;
		if (!selectedPlanViewModel) {
			console.log('Please select a subscription plan');
			return;
		}

		const subscriptionInput: IPluginSubscriptionCreateInput = {
			pluginId: this.pluginId || this.plugin?.id!,
			planId: selectedPlanViewModel.id,
			subscriptionType: selectedPlanViewModel.type,
			billingPeriod: this.subscriptionForm.value.billingPeriod,
			paymentMethodId: this.subscriptionForm.value.paymentMethodId,
			promoCode: this.subscriptionForm.value.promoCode,
			metadata: {
				source: 'plugin-marketplace',
				pluginName: this.plugin?.name
			}
		};

		if (selectedPlanViewModel.isFree) {
			// For free plans, proceed directly to installation
			this.proceedWithInstallation(selectedPlanViewModel.originalPlan, subscriptionInput);
		} else {
			// For paid plans, create subscription using state management
			this.createSubscription(selectedPlanViewModel.originalPlan, subscriptionInput);
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

	// Computed properties for template
	public get canProceedWithoutSubscription(): boolean {
		// Allow skipping subscription if there are free plans or if it's optional
		let hasFreePlans = false;
		this.hasFreePlan$
			.pipe(tap((value) => (hasFreePlans = value)))
			.subscribe()
			.unsubscribe();
		return hasFreePlans || this.plugin?.type === ('FREE' as any);
	}
}
