import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	AbstractControl,
	FormArray,
	FormControl,
	FormGroup,
	ValidationErrors,
	ValidatorFn,
	Validators
} from '@angular/forms';
import { IPlugin, IPluginSource, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { NbDateService, NbDialogRef, NbDialogService, NbStepperComponent } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { asapScheduler, filter, take, tap } from 'rxjs';
import { PluginSourceActions } from '../+state/actions/plugin-source.action';
import { PluginVersionQuery } from '../+state/queries/plugin-version.query';
import { patterns } from '../../../../../constants';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { ToastrNotificationService } from '../../../../../services';
import { IPluginPlanCreateInput, PluginSubscriptionService } from '../../../services/plugin-subscription.service';
import { SourceContext } from './plugin-source/creator/source.context';
import { PluginSubscriptionPlanCreatorComponent } from './plugin-subscription-plan-creator/plugin-subscription-plan-creator.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-marketplace-upload',
	templateUrl: './plugin-marketplace-upload.component.html',
	styleUrls: ['./plugin-marketplace-upload.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceUploadComponent implements OnInit, OnDestroy {
	@ViewChild('stepper', { static: false }) stepper: NbStepperComponent;
	@ViewChild('subscriptionPlanCreator') subscriptionPlanCreator: PluginSubscriptionPlanCreatorComponent;

	readonly pluginTypes = Object.values(PluginType);
	readonly pluginStatuses = Object.values(PluginStatus);
	readonly sourceTypes = Object.values(PluginSourceType);
	readonly today: Date;

	pluginForm: FormGroup;
	plugin: IPlugin;
	isSubmitting = false;
	formTouched = false;
	selectedSourceType: PluginSourceType = PluginSourceType.CDN;

	// Subscription plan properties
	subscriptionPlans: IPluginPlanCreateInput[] = [];
	isSubscriptionStepValid = false;

	constructor(
		private readonly dialogRef: NbDialogRef<PluginMarketplaceUploadComponent>,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		protected readonly dateService: NbDateService<Date>,
		private readonly sourceContext: SourceContext,
		private readonly versionQuery: PluginVersionQuery,
		private readonly dialog: NbDialogService,
		private readonly action: Actions,
		private readonly subscriptionService: PluginSubscriptionService
	) {
		this.today = dateService.today();
	}

	ngOnInit(): void {
		this.initForm();
		this.setupVersionListeners();
	}

	private setupVersionListeners(): void {
		this.versionQuery.version$
			.pipe(
				filter(() => !!this.plugin),
				tap((version) => {
					// Only update if plugin exists and has a version
					if (this.plugin?.version) {
						this.plugin = {
							...this.plugin,
							version
						};
						this.patch();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initForm(): void {
		this.pluginForm = new FormGroup({
			...(this.plugin?.id && { id: new FormControl(this.plugin.id) }),
			name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
			description: new FormControl('', Validators.maxLength(500)),
			type: new FormControl(PluginType.DESKTOP, Validators.required),
			status: new FormControl(PluginStatus.ACTIVE, Validators.required),
			version: this.createVersionGroup(),
			author: new FormControl('', Validators.maxLength(100)),
			license: new FormControl('', Validators.maxLength(50)),
			homepage: new FormControl('', Validators.pattern(patterns.websiteUrl)),
			repository: new FormControl('', Validators.pattern(patterns.websiteUrl)),
			requiresSubscription: new FormControl(false)
		});
	}

	private patch(): void {
		if (!this.plugin) {
			return;
		}

		const {
			name,
			description,
			type,
			status,
			version,
			author,
			license,
			homepage,
			repository,
			requiresSubscription
		} = this.plugin;

		// Patch basic plugin data
		this.pluginForm.patchValue({
			name,
			description,
			type,
			status,
			author,
			license,
			homepage,
			repository,
			requiresSubscription
		});

		// Handle version and sources separately
		if (version) {
			const versionGroup = this.pluginForm.get('version') as FormGroup;
			const sourcesArray = versionGroup?.get('sources') as FormArray;

			// Patch version data (excluding sources)
			versionGroup?.patchValue({
				number: version.number,
				changelog: version.changelog,
				releaseDate: version.releaseDate
			});

			// Clear and repopulate sources array
			if (sourcesArray && version.sources?.length) {
				sourcesArray.clear();
				version.sources.forEach((source) => this.addSource(source.type, source));
			}
		}
	}

	public addSource(type: PluginSourceType = this.selectedSourceType, data?: IPluginSource): void {
		const source = this.sourceContext.getCreator(type).createSource(data);
		this.sources.push(source);
	}

	public removeSource(idx: number): void {
		const source = this.sources.at(idx)?.value as IPluginSource;

		// If the source has an ID, it's persisted and needs confirmation
		if (source?.id && this.plugin?.version) {
			this.dialog
				.open(AlertComponent, {
					context: {
						data: {
							message: this.translateService.instant('PLUGIN.SOURCE.DELETE_CONFIRMATION'),
							title: this.translateService.instant('PLUGIN.SOURCE.DELETE_TITLE'),
							confirmText: this.translateService.instant('BUTTONS.DELETE'),
							status: 'basic'
						}
					}
				})
				.onClose.pipe(
					take(1),
					filter(Boolean),
					tap(() => {
						const { id: pluginId, version } = this.plugin;
						this.action.dispatch(PluginSourceActions.delete(pluginId, version.id, source.id));
						this.sources.removeAt(idx);
					}),
					untilDestroyed(this)
				)
				.subscribe();
		} else {
			// No confirmation needed for unsaved sources
			this.sources.removeAt(idx);
		}
	}

	public restoreSource(idx: number): void {
		const source = this.sources.at(idx)?.value as IPluginSource;

		// Validate source and plugin before showing confirmation
		if (!source?.id || !source?.versionId || !this.plugin?.id) {
			return;
		}

		this.dialog
			.open(AlertComponent, {
				context: {
					data: {
						message: this.translateService.instant('PLUGIN.SOURCE.RESTORE_CONFIRMATION'),
						title: this.translateService.instant('PLUGIN.SOURCE.RESTORE_TITLE'),
						confirmText: this.translateService.instant('BUTTONS.RESTORE'),
						status: 'basic'
					}
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => {
					this.action.dispatch(PluginSourceActions.restore(this.plugin.id, source.versionId, source.id));
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private createVersionGroup(): FormGroup {
		return new FormGroup({
			...(this.plugin?.version?.id && { id: new FormControl(this.plugin.version.id) }),
			number: new FormControl('', [
				Validators.required,
				Validators.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
			]),
			changelog: new FormControl('', [Validators.required, Validators.minLength(10)]),
			releaseDate: new FormControl(this.today, [Validators.required, this.pastDateValidator()]),
			sources: new FormArray([this.sourceContext.getCreator(PluginSourceType.CDN).createSource()])
		});
	}

	/**
	 * Custom validator to ensure the release date is not in the future.
	 */
	private pastDateValidator(): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			if (!control.value) {
				return null;
			}
			const inputDate = new Date(control.value);
			const today = this.dateService.today();
			return inputDate > today ? { futureDate: true } : null;
		};
	}

	public reset(): void {
		this.initForm();
		this.formTouched = false;
		this.isSubmitting = false;
		this.subscriptionPlans = [];
		this.isSubscriptionStepValid = false;
	}

	public submit(): void {
		this.formTouched = true;
		this.markFormGroupTouched(this.pluginForm);

		// Validate form
		if (this.pluginForm.invalid) {
			this.scrollToFirstInvalidControl();
			this.toastrService.error(this.translateService.instant('PLUGIN.FORM.VALIDATION.FAILED'));
			return;
		}

		// Validate subscription plans if required
		const requiresSubscription = this.pluginForm.get('requiresSubscription')?.value;
		if (requiresSubscription && !this.isSubscriptionStepValid) {
			this.toastrService.error(
				this.translateService.instant('PLUGIN.FORM.VALIDATION.SUBSCRIPTION_PLANS_INVALID')
			);
			return;
		}

		this.isSubmitting = true;

		try {
			const pluginData = { ...this.pluginForm.value };

			// Add subscription plans to the plugin data if enabled
			// For edit mode: Only include new plans (existing plans are updated via facade)
			if (requiresSubscription && this.subscriptionPlans.length > 0) {
				pluginData.subscriptionPlans = this.subscriptionPlans;
			}

			// Close dialog with the plugin data
			// The parent will handle the actual save operation
			this.dialogRef.close(pluginData);
		} catch (error) {
			this.toastrService.error(this.translateService.instant('PLUGIN.FORM.SUBMISSION_ERROR'));
			this.isSubmitting = false;
		}
	}

	/**
	 * Handle subscription plan changes from child component
	 */
	public onSubscriptionPlansChanged(plans: IPluginPlanCreateInput[]): void {
		this.subscriptionPlans = plans?.length ? plans.map((plan) => ({ ...plan, pluginId: this.plugin?.id })) : [];
	}

	public onSubscriptionValidationChanged(isValid: boolean): void {
		this.isSubscriptionStepValid = isValid;
	}

	public toggleSubscriptions(enabled: boolean): void {
		if (!enabled) {
			this.subscriptionPlans = [];
			this.isSubscriptionStepValid = true;
		}
	}

	public isSubscriptionStepComplete(): boolean {
		const requiresSubscription = this.pluginForm.get('requiresSubscription')?.value;
		if (!requiresSubscription) {
			return true;
		}
		return this.isSubscriptionStepValid && this.subscriptionPlans.length > 0;
	}

	public canProceedToFinalStep(): boolean {
		const requiresSubscription = this.pluginForm.get('requiresSubscription')?.value;
		return !requiresSubscription || this.isSubscriptionStepComplete();
	}

	public get sources(): FormArray {
		return (this.pluginForm?.get('version') as FormGroup)?.get('sources') as FormArray;
	}

	private scrollToFirstInvalidControl(): void {
		// Use asapScheduler to ensure DOM has updated after marking controls as touched
		asapScheduler.schedule(() => {
			const firstInvalidControl = document.querySelector('form .ng-invalid') as HTMLElement;
			firstInvalidControl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			firstInvalidControl?.focus?.();
		});
	}

	private markFormGroupTouched(formGroup: FormGroup): void {
		Object.values(formGroup.controls).forEach((control) => {
			control.markAsTouched();
			control.markAsDirty();

			if (control instanceof FormGroup) {
				this.markFormGroupTouched(control);
			} else if (control instanceof FormArray) {
				control.controls.forEach((arrayControl) => {
					if (arrayControl instanceof FormGroup) {
						this.markFormGroupTouched(arrayControl);
					} else {
						arrayControl.markAsTouched();
						arrayControl.markAsDirty();
					}
				});
			}
		});
	}

	public dismiss(): void {
		this.dialogRef.close();
	}

	public get isFormInvalid(): boolean {
		return this.pluginForm?.invalid ?? true;
	}

	ngOnDestroy(): void {
		// Clean up is handled by @UntilDestroy decorator
	}
}
