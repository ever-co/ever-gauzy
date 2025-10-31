import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	inject,
	Input,
	OnDestroy,
	OnInit,
	Output
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	IPluginPlanCreateInput,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';

@Component({
	selector: 'lib-plugin-subscription-plan-creator',
	templateUrl: './plugin-subscription-plan-creator.component.html',
	styleUrls: ['./plugin-subscription-plan-creator.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginSubscriptionPlanCreatorComponent implements OnInit, OnDestroy {
	@Input() pluginId?: string;
	@Input() allowMultiplePlans = true;
	@Input() requireAtLeastOnePlan = false;

	@Output() plansChanged = new EventEmitter<IPluginPlanCreateInput[]>();
	@Output() validationStateChanged = new EventEmitter<boolean>();

	public plansForm: FormGroup;
	private destroy$ = new Subject<void>();

	// Expose enums to template
	public readonly PluginSubscriptionType = PluginSubscriptionType;
	public readonly PluginBillingPeriod = PluginBillingPeriod;
	// FormBuilder
	private readonly formBuilder = inject(FormBuilder);

	ngOnInit(): void {
		this.initializeForm();
		this.setupFormListeners();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private initializeForm(): void {
		this.plansForm = this.formBuilder.group({
			plans: this.formBuilder.array([])
		});

		// Add at least one plan if required or by default
		if (this.requireAtLeastOnePlan || this.plans.length === 0) {
			this.addPlan();
		}
	}

	private setupFormListeners(): void {
		this.plansForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
			this.emitChanges();
		});
	}

	private createPlanFormGroup(plan?: Partial<IPluginPlanCreateInput>): FormGroup {
		return this.formBuilder.group({
			type: [plan?.type || PluginSubscriptionType.FREE, Validators.required],
			name: [plan?.name || '', [Validators.required, Validators.maxLength(100)]],
			description: [plan?.description || '', [Validators.required, Validators.maxLength(500)]],
			price: [plan?.price || 0, [Validators.required, Validators.min(0)]],
			currency: [plan?.currency || 'USD', Validators.required],
			billingPeriod: [plan?.billingPeriod || PluginBillingPeriod.MONTHLY, Validators.required],
			features: this.formBuilder.array(
				plan?.features?.map((feature) => this.formBuilder.control(feature, Validators.required)) || [
					this.formBuilder.control('', Validators.required)
				]
			),
			limitations: this.formBuilder.group({
				maxUsers: [plan?.limitations?.maxUsers || null],
				maxProjects: [plan?.limitations?.maxProjects || null],
				apiCallsPerMonth: [plan?.limitations?.apiCallsPerMonth || null],
				storageLimit: [plan?.limitations?.storageLimit || null]
			}),
			trialDays: [plan?.trialDays || 0, [Validators.min(0), Validators.max(365)]],
			setupFee: [plan?.setupFee || 0, [Validators.min(0)]],
			discountPercentage: [plan?.discountPercentage || 0, [Validators.min(0), Validators.max(100)]],
			isPopular: [plan?.isPopular || false],
			isRecommended: [plan?.isRecommended || false]
		});
	}

	public get plans(): FormArray {
		return this.plansForm.get('plans') as FormArray;
	}

	public addPlan(plan?: Partial<IPluginPlanCreateInput>): void {
		if (!this.allowMultiplePlans && this.plans.length >= 1) {
			return;
		}

		const planGroup = this.createPlanFormGroup(plan);
		this.plans.push(planGroup);
		this.emitChanges();
	}

	public removePlan(index: number): void {
		if (this.requireAtLeastOnePlan && this.plans.length <= 1) {
			return;
		}

		this.plans.removeAt(index);
		this.emitChanges();
	}

	public duplicatePlan(index: number): void {
		if (!this.allowMultiplePlans) {
			return;
		}

		const planValue = this.plans.at(index).value;
		const duplicatedPlan = {
			...planValue,
			name: `${planValue.name} (Copy)`
		};
		this.addPlan(duplicatedPlan);
	}

	// Feature management for a specific plan
	public getPlanFeatures(planIndex: number): FormArray {
		const plan = this.plans.at(planIndex) as FormGroup;
		return plan.get('features') as FormArray;
	}

	public addFeature(planIndex: number): void {
		const features = this.getPlanFeatures(planIndex);
		features.push(this.formBuilder.control('', Validators.required));
		this.emitChanges();
	}

	public removeFeature(planIndex: number, featureIndex: number): void {
		const features = this.getPlanFeatures(planIndex);
		if (features.length > 1) {
			features.removeAt(featureIndex);
			this.emitChanges();
		}
	}

	// Auto-fill plan details based on type
	public onPlanTypeChange(planIndex: number): void {
		const plan = this.plans.at(planIndex) as FormGroup;
		const type = plan.get('type')?.value;

		const presets = this.getTypePresets(type);
		plan.patchValue(presets, { emitEvent: false });

		// Update features array
		const features = this.getPlanFeatures(planIndex);
		features.clear();
		presets.features.forEach((feature: string) => {
			features.push(this.formBuilder.control(feature, Validators.required));
		});

		this.emitChanges();
	}

	private getTypePresets(type: PluginSubscriptionType): Partial<IPluginPlanCreateInput> {
		const presets: Record<PluginSubscriptionType, Partial<IPluginPlanCreateInput>> = {
			[PluginSubscriptionType.FREE]: {
				name: 'Free Plan',
				description: 'Basic features for getting started',
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
				price: 0,
				currency: 'USD',
				billingPeriod: PluginBillingPeriod.MONTHLY,
				features: ['Custom features'],
				limitations: {}
			}
		};

		return presets[type] || presets[PluginSubscriptionType.FREE];
	}

	private emitChanges(): void {
		const plansValue = this.plans.value as IPluginPlanCreateInput[];
		const validPlans = plansValue.filter((plan) => this.isPlanValid(plan));

		this.plansChanged.emit(validPlans);

		// Emit validation state
		const isValid = this.isFormValid();
		this.validationStateChanged.emit(isValid);
	}

	private isPlanValid(plan: IPluginPlanCreateInput): boolean {
		return !!(
			plan.name?.trim() &&
			plan.description?.trim() &&
			plan.type &&
			plan.price >= 0 &&
			plan.currency &&
			plan.billingPeriod &&
			plan.features?.length > 0 &&
			plan.features.every((feature) => feature.trim())
		);
	}

	private isFormValid(): boolean {
		if (!this.plansForm.valid) {
			return false;
		}

		if (this.requireAtLeastOnePlan && this.plans.length === 0) {
			return false;
		}

		const plansValue = this.plans.value as IPluginPlanCreateInput[];
		return plansValue.every((plan) => this.isPlanValid(plan));
	}

	// Helper methods for template
	public formatCurrency(amount: number, currency: string): string {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: currency || 'USD'
		}).format(amount);
	}

	public formatBillingPeriod(period: PluginBillingPeriod): string {
		const periodMap = {
			[PluginBillingPeriod.DAILY]: 'day',
			[PluginBillingPeriod.WEEKLY]: 'week',
			[PluginBillingPeriod.MONTHLY]: 'month',
			[PluginBillingPeriod.QUARTERLY]: 'quarter',
			[PluginBillingPeriod.YEARLY]: 'year',
			[PluginBillingPeriod.ONE_TIME]: 'one-time'
		};

		return periodMap[period] || period;
	}

	public canRemovePlan(): boolean {
		return !this.requireAtLeastOnePlan || this.plans.length > 1;
	}

	public canAddPlan(): boolean {
		return this.allowMultiplePlans || this.plans.length === 0;
	}
}
