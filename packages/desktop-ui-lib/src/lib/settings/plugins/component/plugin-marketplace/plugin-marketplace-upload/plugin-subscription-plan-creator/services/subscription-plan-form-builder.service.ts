import { Injectable } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { PluginScope } from '@gauzy/contracts';
import {
	IPluginPlanCreateInput,
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../../../services/plugin-subscription.service';

/**
 * Form Builder Service following the Builder Pattern
 * Responsible for creating and configuring subscription plan forms
 * Ensures proper initialization and validation setup
 *
 * @principle Single Responsibility - Only handles form creation
 * @pattern Builder Pattern - Provides fluent interface for form construction
 */
@Injectable({
	providedIn: 'root'
})
export class SubscriptionPlanFormBuilderService {
	constructor(private readonly formBuilder: FormBuilder) {}

	/**
	 * Creates the main plans form with an empty FormArray
	 */
	public createPlansForm(): FormGroup {
		return this.formBuilder.group({
			plans: this.formBuilder.array([])
		});
	}

	/**
	 * Creates a single plan FormGroup with all required controls
	 * Ensures all controls are initialized before validators are applied
	 *
	 * @param plan Optional plan data for prepopulation
	 */
	public createPlanFormGroup(plan?: Partial<IPluginPlanCreateInput> | IPluginSubscriptionPlan): FormGroup {
		// Extract features array - handle both input and plan types
		const features = this.extractFeatures(plan);

		// Create limitations FormGroup
		const limitationsGroup = this.createLimitationsFormGroup(plan?.limitations);

		// Create features FormArray
		const featuresArray = this.createFeaturesFormArray(features);

		// Build the plan form group with all controls initialized
		const planGroup = this.formBuilder.group({
			id: new FormControl(plan?.id ?? null),
			type: new FormControl(plan?.type ?? PluginSubscriptionType.FREE, [Validators.required]),
			scope: new FormControl(plan?.scope ?? PluginScope.USER, [Validators.required]),
			name: new FormControl(plan?.name ?? '', [Validators.required, Validators.maxLength(100)]),
			description: new FormControl(plan?.description ?? '', [Validators.required, Validators.maxLength(500)]),
			price: new FormControl(plan?.price ?? 0, [Validators.required, Validators.min(0)]),
			currency: new FormControl(plan?.currency ?? 'USD', [Validators.required]),
			billingPeriod: new FormControl(plan?.billingPeriod ?? PluginBillingPeriod.MONTHLY, [Validators.required]),
			features: featuresArray,
			limitations: limitationsGroup,
			trialDays: new FormControl(plan?.trialDays ?? 0, [Validators.min(0), Validators.max(365)]),
			setupFee: new FormControl(plan?.setupFee ?? 0, [Validators.min(0)]),
			discountPercentage: new FormControl(plan?.discountPercentage ?? 0, [
				Validators.min(0),
				Validators.max(100)
			]),
			isPopular: new FormControl(plan?.isPopular ?? false),
			isRecommended: new FormControl(plan?.isRecommended ?? false)
		});

		return planGroup;
	}

	/**
	 * Creates a FormArray for plan features
	 * Ensures at least one feature control exists
	 */
	public createFeaturesFormArray(features?: string[]): FormArray {
		const featuresArray = this.formBuilder.array<FormControl<string>>([]);

		if (features && features.length > 0) {
			features.forEach((feature) => {
				featuresArray.push(new FormControl(feature ?? '', [Validators.required]));
			});
		} else {
			// Add one empty feature by default
			featuresArray.push(new FormControl('', [Validators.required]));
		}

		return featuresArray;
	}

	/**
	 * Creates a FormGroup for plan limitations
	 */
	public createLimitationsFormGroup(limitations?: Record<string, any>): FormGroup {
		return this.formBuilder.group({
			maxUsers: new FormControl(limitations?.maxUsers ?? null),
			maxProjects: new FormControl(limitations?.maxProjects ?? null),
			apiCallsPerMonth: new FormControl(limitations?.apiCallsPerMonth ?? null),
			storageLimit: new FormControl(limitations?.storageLimit ?? null)
		});
	}

	/**
	 * Creates a new feature FormControl
	 */
	public createFeatureControl(value: string = ''): FormControl {
		return new FormControl(value, [Validators.required]);
	}

	/**
	 * Populates a plans FormArray with existing plan data
	 * Clears existing plans before adding new ones to prevent duplicates
	 *
	 * @param plansArray The FormArray to populate
	 * @param plans Array of plan data to add
	 */
	public populatePlansFormArray(
		plansArray: FormArray,
		plans: (IPluginSubscriptionPlan | Partial<IPluginPlanCreateInput>)[]
	): void {
		// Clear existing plans
		plansArray.clear();

		// Add each plan
		plans.forEach((plan) => {
			const planGroup = this.createPlanFormGroup(plan);
			plansArray.push(planGroup);
		});
	}

	/**
	 * Creates a plan FormGroup with preset values based on subscription type
	 */
	public createPlanWithPresets(type: PluginSubscriptionType): FormGroup {
		const presets = this.getTypePresets(type);
		return this.createPlanFormGroup(presets);
	}

	/**
	 * Returns preset configuration for different subscription types
	 */
	private getTypePresets(type: PluginSubscriptionType): Partial<IPluginPlanCreateInput> {
		const presets: Record<PluginSubscriptionType, Partial<IPluginPlanCreateInput>> = {
			[PluginSubscriptionType.FREE]: {
				name: 'Free Plan',
				description: 'Basic features for getting started',
				scope: PluginScope.USER,
				price: 0,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: ['Basic functionality', 'Email support'],
				limitations: {
					maxUsers: 5,
					maxProjects: 3,
					apiCallsPerMonth: 1000
				}
			},
			[PluginSubscriptionType.TRIAL]: {
				name: 'Trial Plan',
				description: 'Full access for a limited time',
				scope: PluginScope.USER,
				price: 0,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				trialDays: 14,
				features: ['All premium features', 'Priority support', 'Advanced analytics'],
				limitations: {}
			},
			[PluginSubscriptionType.BASIC]: {
				name: 'Basic Plan',
				description: 'Essential features for small teams',
				scope: PluginScope.USER,
				price: 9.99,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: ['Core functionality', 'Email support', 'Basic analytics'],
				limitations: {
					maxUsers: 10,
					maxProjects: 10,
					apiCallsPerMonth: 5000
				}
			},
			[PluginSubscriptionType.PREMIUM]: {
				name: 'Premium Plan',
				description: 'Advanced features for growing teams',
				scope: PluginScope.ORGANIZATION,
				price: 29.99,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: ['Advanced functionality', 'Priority support', 'Advanced analytics', 'Integrations'],
				limitations: {
					maxUsers: 50,
					maxProjects: 50,
					apiCallsPerMonth: 25000
				}
			},
			[PluginSubscriptionType.ENTERPRISE]: {
				name: 'Enterprise Plan',
				description: 'Full features for large organizations',
				scope: PluginScope.TENANT,
				price: 99.99,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: [
					'All features',
					'24/7 support',
					'Custom integrations',
					'Advanced security',
					'Dedicated manager'
				],
				limitations: {}
			},
			[PluginSubscriptionType.CUSTOM]: {
				name: 'Custom Plan',
				description: 'Tailored solution for specific needs',
				scope: PluginScope.TENANT,
				price: 0,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: ['Custom features'],
				limitations: {}
			}
		};

		return presets[type] ?? presets[PluginSubscriptionType.FREE];
	}

	/**
	 * Extracts features array from plan data
	 * Handles both IPluginSubscriptionPlan and IPluginPlanCreateInput types
	 */
	private extractFeatures(plan?: Partial<IPluginPlanCreateInput> | IPluginSubscriptionPlan): string[] {
		if (!plan) {
			return [];
		}

		if (Array.isArray(plan.features)) {
			return plan.features;
		}

		return [];
	}

	/**
	 * Validates if a plan data is complete and valid
	 */
	public isPlanDataValid(plan: Partial<IPluginPlanCreateInput>): boolean {
		return !!(
			plan.name?.trim() &&
			plan.description?.trim() &&
			plan.type &&
			typeof plan.price === 'number' &&
			plan.price >= 0 &&
			plan.currency &&
			plan.billingPeriod &&
			Array.isArray(plan.features) &&
			plan.features.length > 0 &&
			plan.features.every((feature) => typeof feature === 'string' && feature.trim())
		);
	}

	/**
	 * Extracts valid plan data from form values
	 * Filters out incomplete or invalid plans
	 */
	public extractValidPlansFromForm(formValue: { plans: IPluginPlanCreateInput[] }): IPluginPlanCreateInput[] {
		if (!formValue?.plans || !Array.isArray(formValue.plans)) {
			return [];
		}

		return formValue.plans.filter((plan) => this.isPlanDataValid(plan));
	}
}
