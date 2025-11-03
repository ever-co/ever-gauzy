import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	EventEmitter,
	inject,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { Observable, of, Subject } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { PluginSubscriptionFacade } from '../../+state/plugin-subscription.facade';
import {
	IPluginPlanCreateInput,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';
import { SubscriptionPlanFormBuilderService } from './services/subscription-plan-form-builder.service';
import { SubscriptionPlanFormatService } from './services/subscription-plan-format.service';

/**
 * Component for creating and managing subscription plans for plugins
 *
 * @principle Single Responsibility - Manages subscription plan forms
 * @principle Open/Closed - Extensible through inputs and outputs
 * @principle Dependency Inversion - Depends on abstractions (facade, services)
 * @pattern Facade Pattern - Uses PluginSubscriptionFacade for state management
 * @pattern Builder Pattern - Uses SubscriptionPlanFormBuilderService for form creation
 */
@Component({
	selector: 'lib-plugin-subscription-plan-creator',
	templateUrl: './plugin-subscription-plan-creator.component.html',
	styleUrls: ['./plugin-subscription-plan-creator.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginSubscriptionPlanCreatorComponent implements OnInit, OnDestroy {
	@Input() set pluginId(value: string | undefined) {
		if (this._pluginId !== value) {
			this._pluginId = value;
			// Reset loaded flag when pluginId changes
			this.plansLoaded = false;
			if (this.isInitialized && value) {
				this.loadExistingPlans();
			}
		}
	}
	get pluginId(): string | undefined {
		return this._pluginId;
	}
	private _pluginId?: string;

	@Input() allowMultiplePlans = true;
	@Input() requireAtLeastOnePlan = false;

	@Output() plansChanged = new EventEmitter<IPluginPlanCreateInput[]>();
	@Output() validationStateChanged = new EventEmitter<boolean>();

	public plansForm!: FormGroup;
	private destroy$ = new Subject<void>();
	private isInitialized = false;
	private plansLoaded = false;

	// Track existing plan IDs to differentiate between new and existing plans
	private existingPlanIds = new Set<string>();
	private planIdMap = new Map<number, string>(); // Maps form array index to plan ID

	// Expose enums to template
	public readonly PluginSubscriptionType = PluginSubscriptionType;
	public readonly PluginBillingPeriod = PluginBillingPeriod;

	// Inject services following Dependency Injection
	private readonly formBuilderService = inject(SubscriptionPlanFormBuilderService);
	private readonly formatService = inject(SubscriptionPlanFormatService);
	private readonly subscriptionFacade = inject(PluginSubscriptionFacade);
	private readonly cdr = inject(ChangeDetectorRef);

	// Expose loading states to template
	public readonly loading$ = this.subscriptionFacade.loading$;
	public readonly creating$ = this.subscriptionFacade.creating$;
	public readonly updating$ = this.subscriptionFacade.updating$;
	public readonly deleting$ = this.subscriptionFacade.deleting$;
	public readonly error$ = this.subscriptionFacade.error$;

	ngOnInit(): void {
		this.initializeComponent();
	}

	ngOnDestroy(): void {
		// Clean up subscriptions
		this.destroy$.next();
		this.destroy$.complete();

		// Reset any pending state
		if (this.pluginId) {
			this.subscriptionFacade.resetError();
		}
	}

	/**
	 * Initializes the component, form, and loads existing plans if pluginId is provided
	 */
	private initializeComponent(): void {
		this.initializeForm();
		this.setupFormListeners();
		this.loadExistingPlans();
		this.isInitialized = true;
	}

	/**
	 * Initializes the plans form using the form builder service
	 */
	private initializeForm(): void {
		this.plansForm = this.formBuilderService.createPlansForm();

		// Add at least one plan if required and no pluginId (new plugin)
		if (this.requireAtLeastOnePlan && !this.pluginId) {
			this.addPlan();
		}
	}

	/**
	 * Sets up reactive form listeners
	 */
	private setupFormListeners(): void {
		this.plansForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
			this.emitChanges();
		});
	}

	/**
	 * Loads existing plans from state if pluginId is provided
	 * Uses state management through facade (no direct service calls)
	 * Fixed: Removed filter that blocked empty arrays, allowing proper state updates
	 */
	private loadExistingPlans(): void {
		if (!this.pluginId) {
			return;
		}

		// Dispatch action to load plans
		this.subscriptionFacade.loadPluginPlans(this.pluginId);

		// Subscribe to plans from state
		// Fixed: Allow empty arrays to complete the loading process
		this.subscriptionFacade
			.getPlansForPlugin(this.pluginId)
			.pipe(
				filter(() => !this.plansLoaded), // Only prevent duplicate loads
				take(1),
				takeUntil(this.destroy$)
			)
			.subscribe((plans) => {
				if (plans && plans.length > 0) {
					this.prepopulatePlans(plans);
				}
				this.plansLoaded = true;
				this.cdr.markForCheck();
				// Emit initial state after loading
				this.emitChanges();
			});
	}

	/**
	 * Prepopulates the form with existing plans
	 * Prevents duplicate additions by checking plansLoaded flag
	 * Tracks existing plan IDs for update/delete operations
	 */
	private prepopulatePlans(plans: IPluginSubscriptionPlan[]): void {
		if (!plans || plans.length === 0) {
			return;
		}

		// Clear existing tracking
		this.existingPlanIds.clear();
		this.planIdMap.clear();

		// Convert IPluginSubscriptionPlan to IPluginPlanCreateInput format
		const planInputs: Partial<IPluginPlanCreateInput>[] = plans.map((plan, index) => {
			// Track existing plan IDs
			if (plan.id) {
				this.existingPlanIds.add(plan.id);
				this.planIdMap.set(index, plan.id);
			}

			return {
				pluginId: plan.pluginId,
				type: plan.type,
				name: plan.name,
				description: plan.description,
				price: plan.price,
				currency: plan.currency,
				billingPeriod: plan.billingPeriod,
				features: plan.features,
				limitations: plan.limitations,
				trialDays: plan.trialDays,
				setupFee: plan.setupFee,
				discountPercentage: plan.discountPercentage,
				isPopular: plan.isPopular,
				isRecommended: plan.isRecommended
			};
		});

		// Use form builder service to populate plans
		this.formBuilderService.populatePlansFormArray(this.plans, planInputs);
	}

	/**
	 * Gets the plans FormArray from the form
	 */
	public get plans(): FormArray {
		return this.plansForm?.get('plans') as FormArray;
	}

	/**
	 * Adds a new plan to the form
	 * Uses the form builder service for plan creation
	 */
	public addPlan(plan?: Partial<IPluginPlanCreateInput>): void {
		if (!this.allowMultiplePlans && this.plans.length > 0) {
			return;
		}

		const planGroup = this.formBuilderService.createPlanFormGroup(plan);
		this.plans.push(planGroup);
		this.emitChanges();
	}

	/**
	 * Removes a plan from the form at the specified index
	 * If it's an existing plan, dispatches delete action through facade
	 * Fixed: Properly handle async delete and update mappings
	 */
	public removePlan(index: number): void {
		if (this.requireAtLeastOnePlan && this.plans.length <= 1) {
			return;
		}

		// Check if this is an existing plan
		const planId = this.planIdMap.get(index);

		// Remove from form array immediately for UI responsiveness
		this.plans.removeAt(index);

		// If it's an existing plan, dispatch delete action
		if (planId && this.existingPlanIds.has(planId)) {
			// Dispatch delete action for existing plan
			this.subscriptionFacade.deletePlan(planId);
			this.existingPlanIds.delete(planId);
		}

		// Update plan ID mapping for remaining plans
		const updatedMap = new Map<number, string>();
		this.planIdMap.forEach((id, idx) => {
			if (idx > index) {
				updatedMap.set(idx - 1, id);
			} else if (idx < index) {
				updatedMap.set(idx, id);
			}
		});
		this.planIdMap = updatedMap;

		this.emitChanges();
	}

	/**
	 * Duplicates an existing plan
	 */
	public duplicatePlan(index: number): void {
		if (!this.allowMultiplePlans) {
			return;
		}

		const planValue = this.plans.at(index).value as IPluginPlanCreateInput;
		const duplicatedPlan: Partial<IPluginPlanCreateInput> = {
			...planValue,
			name: `${planValue.name} (Copy)`
		};
		this.addPlan(duplicatedPlan);
	}

	/**
	 * Gets the features FormArray for a specific plan
	 */
	public getPlanFeatures(planIndex: number): FormArray {
		const plan = this.plans.at(planIndex) as FormGroup;
		return plan.get('features') as FormArray;
	}

	/**
	 * Adds a new feature to a plan
	 */
	public addFeature(planIndex: number): void {
		const features = this.getPlanFeatures(planIndex);
		const featureControl = this.formBuilderService.createFeatureControl();
		features.push(featureControl);
		this.emitChanges();
	}

	/**
	 * Removes a feature from a plan
	 */
	public removeFeature(planIndex: number, featureIndex: number): void {
		const features = this.getPlanFeatures(planIndex);
		if (features.length > 1) {
			features.removeAt(featureIndex);
			this.emitChanges();
		}
	}

	/**
	 * Handles plan type change and applies preset values
	 * Uses the form builder service for preset creation
	 */
	public onPlanTypeChange(planIndex: number): void {
		const plan = this.plans.at(planIndex) as FormGroup;
		const type = plan.get('type')?.value as PluginSubscriptionType;

		if (!type) {
			return;
		}

		// Create a new plan with presets
		const presetPlan = this.formBuilderService.createPlanWithPresets(type);
		const presetValue = presetPlan.value;

		// Patch the current plan with preset values (excluding type to avoid recursion)
		plan.patchValue(
			{
				name: presetValue.name,
				description: presetValue.description,
				price: presetValue.price,
				currency: presetValue.currency,
				billingPeriod: presetValue.billingPeriod,
				limitations: presetValue.limitations,
				trialDays: presetValue.trialDays,
				setupFee: presetValue.setupFee,
				discountPercentage: presetValue.discountPercentage,
				isPopular: presetValue.isPopular,
				isRecommended: presetValue.isRecommended
			},
			{ emitEvent: false }
		);

		// Update features array
		const features = this.getPlanFeatures(planIndex);
		features.clear();
		const presetFeatures = presetValue.features as string[];
		if (presetFeatures && presetFeatures.length > 0) {
			presetFeatures.forEach((feature: string) => {
				features.push(this.formBuilderService.createFeatureControl(feature));
			});
		}

		this.emitChanges();
	}

	/**
	 * Emits form changes and validation state to parent component
	 * Uses form builder service for validation
	 */
	private emitChanges(): void {
		if (!this.isInitialized) {
			return;
		}

		const formValue = this.plansForm.value;
		const validPlans = this.formBuilderService.extractValidPlansFromForm(formValue);

		// Add pluginId to each plan if available
		const plansWithPluginId = validPlans.map((plan) => ({
			...plan,
			pluginId: this.pluginId || plan.pluginId
		}));

		this.plansChanged.emit(plansWithPluginId);

		// Emit validation state
		const isValid = this.isFormValid();
		this.validationStateChanged.emit(isValid);
	}

	/**
	 * Validates if the entire form is valid
	 */
	private isFormValid(): boolean {
		if (this.plansForm?.invalid) {
			return false;
		}

		if (this.requireAtLeastOnePlan && this.plans.length === 0) {
			return false;
		}

		const formValue = this.plansForm.value;
		const validPlans = this.formBuilderService.extractValidPlansFromForm(formValue);

		return validPlans.length > 0;
	}

	/**
	 * Formats currency using the format service
	 */
	public formatCurrency(amount: number, currency: string): string {
		return this.formatService.formatCurrency(amount, currency);
	}

	/**
	 * Formats billing period using the format service
	 */
	public formatBillingPeriod(period: PluginBillingPeriod): string {
		return this.formatService.formatBillingPeriod(period);
	}

	/**
	 * Checks if a plan can be removed based on configuration
	 */
	public canRemovePlan(): boolean {
		return !this.requireAtLeastOnePlan || this.plans.length > 1;
	}

	/**
	 * Checks if a plan can be added based on configuration
	 */
	public canAddPlan(): boolean {
		return this.allowMultiplePlans || this.plans.length === 0;
	}

	/**
	 * Checks if a plan at the given index is an existing plan (has an ID)
	 */
	public isExistingPlan(index: number): boolean {
		const planId = this.planIdMap.get(index);
		return !!planId && this.existingPlanIds.has(planId);
	}

	/**
	 * Updates an existing plan via the facade
	 * This is called when clicking the update button for existing plans
	 */
	public updateExistingPlan(index: number): void {
		const planId = this.planIdMap.get(index);
		if (!planId || !this.existingPlanIds.has(planId)) {
			console.warn('Cannot update: Plan ID not found or not an existing plan', { index, planId });
			return;
		}

		const plan = this.plans.at(index) as FormGroup;
		if (!plan) {
			console.warn('Cannot update: Plan form group not found at index', index);
			return;
		}

		// Mark all fields as touched to show validation errors
		Object.keys(plan.controls).forEach((key) => {
			const control = plan.get(key);
			control?.markAsTouched();
			control?.markAsDirty();
		});

		if (plan.invalid) {
			console.warn('Cannot update: Plan form is invalid', { index, errors: plan.errors, value: plan.value });
			return;
		}

		const planValue = plan.value as IPluginPlanCreateInput;

		// Build the update payload directly from form value
		const updates: Partial<IPluginPlanCreateInput> = {
			type: planValue.type,
			name: planValue.name,
			description: planValue.description,
			price: planValue.price,
			currency: planValue.currency,
			billingPeriod: planValue.billingPeriod,
			features: planValue.features || [],
			limitations: planValue.limitations,
			trialDays: planValue.trialDays,
			setupFee: planValue.setupFee,
			discountPercentage: planValue.discountPercentage,
			isPopular: planValue.isPopular,
			isRecommended: planValue.isRecommended
		};

		console.log('Updating existing plan:', { planId, index, updates });

		// Dispatch update action through facade
		this.subscriptionFacade.updatePlan(planId, updates as any);
	}

	/**
	 * Saves all plans - creates new plans and updates existing ones
	 * Separates new plans from existing ones to avoid duplication
	 * Returns an observable to allow parent to wait for completion
	 * Fixed: Actually triggers the save operations through facade
	 */
	public savePlans(): Observable<{ newPlans: IPluginPlanCreateInput[]; updatedCount: number }> {
		if (!this.isFormValid()) {
			return of({ newPlans: [], updatedCount: 0 });
		}

		const formValue = this.plansForm.value;
		const allPlans = this.formBuilderService.extractValidPlansFromForm(formValue);

		// Separate new plans from existing ones
		const newPlans: IPluginPlanCreateInput[] = [];
		const updatedPlans: Array<{ id: string; updates: Partial<IPluginPlanCreateInput> }> = [];

		allPlans.forEach((plan, index) => {
			const planId = this.planIdMap.get(index);
			const planWithPluginId = {
				...plan,
				pluginId: this.pluginId || plan.pluginId
			};

			if (planId && this.existingPlanIds.has(planId)) {
				// Existing plan - prepare for update
				const { pluginId, ...updates } = planWithPluginId;
				updatedPlans.push({ id: planId, updates });
			} else {
				// New plan - prepare for creation
				newPlans.push(planWithPluginId);
			}
		});

		// Dispatch update actions for existing plans
		updatedPlans.forEach(({ id, updates }) => {
			this.subscriptionFacade.updatePlan(id, updates as any);
		});

		// Dispatch bulk create action for new plans
		if (newPlans.length > 0) {
			// Remove id, createdAt, updatedAt, isActive fields for creation
			const plansForCreation = newPlans.map(
				({ pluginId, type, name, description, price, currency, billingPeriod, features, ...rest }) => ({
					pluginId,
					type,
					name,
					description,
					price,
					currency,
					billingPeriod,
					features,
					...rest
				})
			);
			this.subscriptionFacade.bulkCreatePlans(plansForCreation);
		}

		// Emit only new plans to parent component
		this.plansChanged.emit(newPlans);

		// Return result for async handling
		return of({ newPlans, updatedCount: updatedPlans.length });
	}

	/**
	 * Gets the plan ID for a given index
	 */
	public getPlanId(index: number): string | undefined {
		return this.planIdMap.get(index);
	}

	/**
	 * Gets the current form validity state
	 */
	public get isValid(): boolean {
		return this.isFormValid();
	}

	/**
	 * Gets the current plans to be saved (for parent component)
	 */
	public getPlansForSubmission(): IPluginPlanCreateInput[] {
		if (!this.isFormValid()) {
			return [];
		}

		const formValue = this.plansForm.value;
		const allPlans = this.formBuilderService.extractValidPlansFromForm(formValue);

		// Return only new plans (existing plans are updated via facade)
		return allPlans
			.filter((plan, index) => {
				const planId = this.planIdMap.get(index);
				return !planId || !this.existingPlanIds.has(planId);
			})
			.map((plan) => ({
				...plan,
				pluginId: this.pluginId || plan.pluginId
			}));
	}
}
