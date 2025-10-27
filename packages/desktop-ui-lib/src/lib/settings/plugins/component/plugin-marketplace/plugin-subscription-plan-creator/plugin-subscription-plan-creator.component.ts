import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import {
	IPluginPlanCreateInput,
	PluginBillingPeriod,
	PluginSubscriptionService,
	PluginSubscriptionType
} from '../../../services/plugin-subscription.service';

interface ISubscriptionPlanFormData extends Omit<IPluginPlanCreateInput, 'pluginId'> {
	id?: string;
	isPopular?: boolean;
	isRecommended?: boolean;
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-subscription-plan-creator',
	templateUrl: './plugin-subscription-plan-creator.component.html',
	styleUrls: ['./plugin-subscription-plan-creator.component.scss'],
	standalone: false
})
export class PluginSubscriptionPlanCreatorComponent implements OnInit, OnDestroy {
	@Input() pluginId?: string;
	@Input() existingPlans: ISubscriptionPlanFormData[] = [];
	@Input() allowMultiplePlans: boolean = true;
	@Input() requireAtLeastOnePlan: boolean = false;
	@Output() plansChanged = new EventEmitter<ISubscriptionPlanFormData[]>();
	@Output() validationStateChanged = new EventEmitter<boolean>();

	public subscriptionForm: FormGroup;
	public isLoading$ = new BehaviorSubject<boolean>(false);
	public plans: ISubscriptionPlanFormData[] = [];

	// Enum references for template
	public PluginSubscriptionType = PluginSubscriptionType;
	public PluginBillingPeriod = PluginBillingPeriod;

	// Available currencies
	public availableCurrencies = [
		{ code: 'USD', symbol: '$', name: 'US Dollar' },
		{ code: 'EUR', symbol: '€', name: 'Euro' },
		{ code: 'GBP', symbol: '£', name: 'British Pound' },
		{ code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
		{ code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
		{ code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }
	];

	// Predefined features for quick selection
	public commonFeatures = [
		'Basic support',
		'Email support',
		'Priority support',
		'24/7 support',
		'Phone support',
		'Dedicated account manager',
		'Custom integrations',
		'Advanced analytics',
		'API access',
		'Webhook support',
		'Custom branding',
		'White-label solution',
		'Single sign-on (SSO)',
		'Advanced security',
		'Audit logs',
		'Data export',
		'Backup & restore',
		'Multi-user collaboration',
		'Team management',
		'Role-based permissions',
		'Custom workflows',
		'Automation features',
		'Real-time notifications',
		'Mobile app access',
		'Offline functionality'
	];

	constructor(
		private readonly formBuilder: FormBuilder,
		private readonly dialogService: NbDialogService,
		private readonly translateService: TranslateService,
		private readonly subscriptionService: PluginSubscriptionService
	) {
		this.initializeForm();
	}

	ngOnInit(): void {
		this.loadExistingPlans();
		this.setupFormValidation();
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	private initializeForm(): void {
		this.subscriptionForm = this.formBuilder.group({
			plans: this.formBuilder.array([])
		});
	}

	private loadExistingPlans(): void {
		if (this.existingPlans.length > 0) {
			this.plans = [...this.existingPlans];
			this.populateFormWithExistingPlans();
		} else {
			// Add default free plan
			this.addDefaultFreePlan();
		}
	}

	private populateFormWithExistingPlans(): void {
		const plansArray = this.subscriptionForm.get('plans') as FormArray;
		plansArray.clear();

		this.plans.forEach((plan) => {
			plansArray.push(this.createPlanFormGroup(plan));
		});

		this.emitChanges();
	}

	private addDefaultFreePlan(): void {
		const freePlan: ISubscriptionPlanFormData = {
			type: PluginSubscriptionType.FREE,
			name: 'Free',
			description: 'Basic features for personal use',
			price: 0,
			currency: 'USD',
			billingPeriod: PluginBillingPeriod.MONTHLY,
			features: ['Basic plugin functionality', 'Community support'],
			limitations: {
				maxUsers: 1,
				maxProjects: 3,
				storageGB: 1
			}
		};

		this.addPlan(freePlan);
	}

	private setupFormValidation(): void {
		this.subscriptionForm.valueChanges.pipe(untilDestroyed(this)).subscribe(() => {
			this.updatePlansFromForm();
			this.emitValidationState();
			this.emitChanges();
		});
	}

	public addPlan(planData?: Partial<ISubscriptionPlanFormData>): void {
		const plansArray = this.subscriptionForm.get('plans') as FormArray;

		const newPlan: ISubscriptionPlanFormData = {
			type: PluginSubscriptionType.BASIC,
			name: '',
			description: '',
			price: 9.99,
			currency: 'USD',
			billingPeriod: PluginBillingPeriod.MONTHLY,
			features: [],
			...planData
		};

		plansArray.push(this.createPlanFormGroup(newPlan));
		this.plans.push(newPlan);
		this.emitChanges();
	}

	public removePlan(index: number): void {
		const plansArray = this.subscriptionForm.get('plans') as FormArray;
		plansArray.removeAt(index);
		this.plans.splice(index, 1);
		this.emitChanges();
	}

	public duplicatePlan(index: number): void {
		const planToDuplicate = this.plans[index];
		const duplicatedPlan: ISubscriptionPlanFormData = {
			...planToDuplicate,
			name: `${planToDuplicate.name} (Copy)`,
			type: this.getNextSubscriptionType(planToDuplicate.type)
		};

		this.addPlan(duplicatedPlan);
	}

	private createPlanFormGroup(plan: ISubscriptionPlanFormData): FormGroup {
		return this.formBuilder.group({
			type: [plan.type, Validators.required],
			name: [plan.name, [Validators.required, Validators.maxLength(100)]],
			description: [plan.description, [Validators.required, Validators.maxLength(500)]],
			price: [plan.price, [Validators.required, Validators.min(0)]],
			currency: [plan.currency, Validators.required],
			billingPeriod: [plan.billingPeriod, Validators.required],
			features: this.formBuilder.array(
				plan.features.map((feature) => this.formBuilder.control(feature, Validators.required))
			),
			limitations: this.formBuilder.group({
				maxUsers: [plan.limitations?.maxUsers],
				maxProjects: [plan.limitations?.maxProjects],
				storageGB: [plan.limitations?.storageGB],
				apiCallsPerMonth: [plan.limitations?.apiCallsPerMonth],
				customLimitations: this.formBuilder.array(
					Object.entries(plan.limitations?.customLimitations || {}).map(([key, value]) =>
						this.formBuilder.group({
							key: [key, Validators.required],
							value: [value, Validators.required]
						})
					)
				)
			}),
			trialDays: [plan.trialDays],
			setupFee: [plan.setupFee, Validators.min(0)],
			discountPercentage: [plan.discountPercentage, [Validators.min(0), Validators.max(100)]],
			isPopular: [plan.isPopular || false],
			isRecommended: [plan.isRecommended || false]
		});
	}

	public getPlanFormGroup(index: number): FormGroup {
		const plansArray = this.subscriptionForm.get('plans') as FormArray;
		return plansArray.at(index) as FormGroup;
	}

	public getFeaturesArray(planIndex: number): FormArray {
		const planGroup = this.getPlanFormGroup(planIndex);
		return planGroup.get('features') as FormArray;
	}

	public getCustomLimitationsArray(planIndex: number): FormArray {
		const planGroup = this.getPlanFormGroup(planIndex);
		const limitationsGroup = planGroup.get('limitations') as FormGroup;
		return limitationsGroup.get('customLimitations') as FormArray;
	}

	public addFeature(planIndex: number, feature?: string): void {
		const featuresArray = this.getFeaturesArray(planIndex);
		featuresArray.push(this.formBuilder.control(feature || '', Validators.required));
	}

	public removeFeature(planIndex: number, featureIndex: number): void {
		const featuresArray = this.getFeaturesArray(planIndex);
		featuresArray.removeAt(featureIndex);
	}

	public addCustomLimitation(planIndex: number): void {
		const customLimitationsArray = this.getCustomLimitationsArray(planIndex);
		customLimitationsArray.push(
			this.formBuilder.group({
				key: ['', Validators.required],
				value: ['', Validators.required]
			})
		);
	}

	public removeCustomLimitation(planIndex: number, limitationIndex: number): void {
		const customLimitationsArray = this.getCustomLimitationsArray(planIndex);
		customLimitationsArray.removeAt(limitationIndex);
	}

	public addCommonFeature(planIndex: number, feature: string): void {
		const featuresArray = this.getFeaturesArray(planIndex);

		// Check if feature already exists
		const currentFeatures = featuresArray.value;
		if (!currentFeatures.includes(feature)) {
			this.addFeature(planIndex, feature);
		}
	}

	public setPopularPlan(index: number): void {
		// Remove popular flag from all plans
		const plansArray = this.subscriptionForm.get('plans') as FormArray;
		plansArray.controls.forEach((control, i) => {
			control.get('isPopular')?.setValue(i === index);
		});
	}

	public setRecommendedPlan(index: number): void {
		// Remove recommended flag from all plans
		const plansArray = this.subscriptionForm.get('plans') as FormArray;
		plansArray.controls.forEach((control, i) => {
			control.get('isRecommended')?.setValue(i === index);
		});
	}

	public previewPlan(index: number): void {
		const plan = this.plans[index];
		// Open a preview dialog showing how the plan will look to customers
		// This would be implemented based on your dialog system
		console.log('Preview plan:', plan);
	}

	public calculateMonthlyPrice(plan: ISubscriptionPlanFormData): number {
		switch (plan.billingPeriod) {
			case PluginBillingPeriod.YEARLY:
				return plan.price / 12;
			case PluginBillingPeriod.QUARTERLY:
				return plan.price / 3;
			case PluginBillingPeriod.WEEKLY:
				return plan.price * 4.33; // Average weeks per month
			case PluginBillingPeriod.DAILY:
				return plan.price * 30; // Average days per month
			default:
				return plan.price;
		}
	}

	public calculateYearlySavings(plan: ISubscriptionPlanFormData): number {
		if (plan.billingPeriod === PluginBillingPeriod.YEARLY) {
			const monthlyEquivalent = this.calculateMonthlyPrice(plan) * 12;
			return monthlyEquivalent - plan.price;
		}
		return 0;
	}

	public getSubscriptionTypeOptions(): Array<{ value: PluginSubscriptionType; label: string }> {
		return [
			{ value: PluginSubscriptionType.FREE, label: 'Free' },
			{ value: PluginSubscriptionType.TRIAL, label: 'Trial' },
			{ value: PluginSubscriptionType.BASIC, label: 'Basic' },
			{ value: PluginSubscriptionType.PREMIUM, label: 'Premium' },
			{ value: PluginSubscriptionType.ENTERPRISE, label: 'Enterprise' },
			{ value: PluginSubscriptionType.CUSTOM, label: 'Custom' }
		];
	}

	public getBillingPeriodOptions(): Array<{ value: PluginBillingPeriod; label: string }> {
		return [
			{ value: PluginBillingPeriod.DAILY, label: 'Daily' },
			{ value: PluginBillingPeriod.WEEKLY, label: 'Weekly' },
			{ value: PluginBillingPeriod.MONTHLY, label: 'Monthly' },
			{ value: PluginBillingPeriod.QUARTERLY, label: 'Quarterly' },
			{ value: PluginBillingPeriod.YEARLY, label: 'Yearly' },
			{ value: PluginBillingPeriod.ONE_TIME, label: 'One-time' }
		];
	}

	private getNextSubscriptionType(currentType: PluginSubscriptionType): PluginSubscriptionType {
		const types = [
			PluginSubscriptionType.FREE,
			PluginSubscriptionType.BASIC,
			PluginSubscriptionType.PREMIUM,
			PluginSubscriptionType.ENTERPRISE
		];

		const currentIndex = types.indexOf(currentType);
		const nextIndex = (currentIndex + 1) % types.length;
		return types[nextIndex];
	}

	private updatePlansFromForm(): void {
		const formValue = this.subscriptionForm.value;
		if (formValue.plans) {
			this.plans = formValue.plans.map((planForm: any) => ({
				...planForm,
				limitations: {
					...planForm.limitations,
					customLimitations: planForm.limitations?.customLimitations?.reduce((acc: any, item: any) => {
						if (item.key && item.value) {
							acc[item.key] = item.value;
						}
						return acc;
					}, {})
				}
			}));
		}
	}

	private emitChanges(): void {
		this.plansChanged.emit([...this.plans]);
	}

	private emitValidationState(): void {
		const isValid = this.isFormValid();
		this.validationStateChanged.emit(isValid);
	}

	public isFormValid(): boolean {
		if (this.requireAtLeastOnePlan && this.plans.length === 0) {
			return false;
		}

		return this.subscriptionForm.valid;
	}

	public getFormErrors(): string[] {
		const errors: string[] = [];

		if (this.requireAtLeastOnePlan && this.plans.length === 0) {
			errors.push('At least one subscription plan is required');
		}

		const plansArray = this.subscriptionForm.get('plans') as FormArray;
		plansArray.controls.forEach((planControl, index) => {
			if (planControl.invalid) {
				const planGroup = planControl as FormGroup;
				Object.keys(planGroup.controls).forEach((controlName) => {
					const control = planGroup.get(controlName);
					if (control?.invalid) {
						errors.push(`Plan ${index + 1}: ${controlName} is invalid`);
					}
				});
			}
		});

		return errors;
	}

	public hasFreePlan(): boolean {
		return this.plans.some((plan) => plan.type === PluginSubscriptionType.FREE);
	}

	public getPopularPlanIndex(): number {
		return this.plans.findIndex((plan) => plan.isPopular);
	}

	public getRecommendedPlanIndex(): number {
		return this.plans.findIndex((plan) => plan.isRecommended);
	}

	public formatPrice(price: number, currency: string): string {
		const currencyInfo = this.availableCurrencies.find((c) => c.code === currency);
		const symbol = currencyInfo?.symbol || currency;

		if (price === 0) {
			return 'Free';
		}

		return `${symbol}${price.toFixed(2)}`;
	}

	public getPlanTypeColor(type: PluginSubscriptionType): string {
		const colorMap = {
			[PluginSubscriptionType.FREE]: 'success',
			[PluginSubscriptionType.TRIAL]: 'info',
			[PluginSubscriptionType.BASIC]: 'primary',
			[PluginSubscriptionType.PREMIUM]: 'warning',
			[PluginSubscriptionType.ENTERPRISE]: 'danger',
			[PluginSubscriptionType.CUSTOM]: 'basic'
		};

		return colorMap[type] || 'basic';
	}

	public getPlanTypeIcon(type: PluginSubscriptionType): string {
		const iconMap = {
			[PluginSubscriptionType.FREE]: 'gift-outline',
			[PluginSubscriptionType.TRIAL]: 'clock-outline',
			[PluginSubscriptionType.BASIC]: 'person-outline',
			[PluginSubscriptionType.PREMIUM]: 'star-outline',
			[PluginSubscriptionType.ENTERPRISE]: 'briefcase-outline',
			[PluginSubscriptionType.CUSTOM]: 'settings-outline'
		};

		return iconMap[type] || 'pricetags-outline';
	}
}
