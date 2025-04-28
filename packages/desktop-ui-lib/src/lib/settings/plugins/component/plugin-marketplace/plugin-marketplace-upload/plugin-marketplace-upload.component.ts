import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { IPlugin, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDateService, NbDialogRef, NbStepperComponent } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, Subject, takeUntil, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../services';

@Component({
	selector: 'lib-plugin-marketplace-upload',
	templateUrl: './plugin-marketplace-upload.component.html',
	styleUrls: ['./plugin-marketplace-upload.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceUploadComponent implements OnInit, OnDestroy {
	@ViewChild('stepper', { static: false }) stepper: NbStepperComponent;

	pluginForm: FormGroup;
	plugin: IPlugin;
	pluginTypes = Object.values(PluginType);
	pluginStatuses = Object.values(PluginStatus);
	sourceTypes = Object.values(PluginSourceType);
	isSubmitting = false;
	formTouched = false;
	today: Date; // Ensures a proper date comparison
	destroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<PluginMarketplaceUploadComponent>,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		protected readonly dateService: NbDateService<Date>
	) {
		this.today = dateService.today();
	}

	ngOnInit(): void {
		this.initForm();
		this.setupSourceTypeListener();
		this.patch();
	}

	private initForm(): void {
		this.pluginForm = this.fb.group({
			...(this.plugin && this.plugin.id && { id: [this.plugin.id] }),
			name: ['', [Validators.required, Validators.maxLength(100)]],
			description: ['', Validators.maxLength(500)],
			type: [PluginType.DESKTOP, Validators.required],
			status: [PluginStatus.ACTIVE, Validators.required],
			version: this.createVersionGroup(),
			author: ['', Validators.maxLength(100)],
			license: ['', Validators.maxLength(50)],
			homepage: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)],
			repository: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)]
		});
	}

	private patch(): void {
		if (!this.plugin) return;

		const { name, description, type, status, version, source, author, license, homepage, repository } = this.plugin;

		const data: Partial<IPlugin> = {
			name,
			description,
			type,
			status,
			author,
			license,
			homepage,
			repository
		};

		if (version) {
			data.version = { ...version };
			if (source) {
				data.version.source = { ...source };
				this.onSourceTypeChange(source.type);
			}
		}

		this.pluginForm.patchValue(data);
	}

	private createVersionGroup(): FormGroup {
		return this.fb.group({
			...(this.plugin?.version?.id && { id: [this.plugin.version.id] }),
			number: ['', [Validators.required, Validators.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)]],
			changelog: ['', [Validators.required, Validators.minLength(10)]],
			releaseDate: [this.today, [Validators.required, this.pastDateValidator()]],
			source: this.createSourceGroup(PluginSourceType.CDN)
		});
	}

	/**
	 * Custom validator to ensure the release date is not in the future.
	 */
	private pastDateValidator(): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			if (!control.value) return null;
			const inputDate = new Date(control.value);
			return inputDate > this.today ? { futureDate: true } : null;
		};
	}

	private createSourceGroup(type: PluginSourceType): FormGroup {
		const sourceId = this.plugin && this.plugin.source.id ? { id: [this.plugin.source.id] } : {};
		switch (type) {
			case PluginSourceType.CDN:
				return this.fb.group({
					...sourceId,
					type: [PluginSourceType.CDN],
					url: [
						'',
						[
							Validators.required,
							Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)
						]
					],
					integrity: [''],
					crossOrigin: ['', Validators.maxLength(50)]
				});

			case PluginSourceType.NPM:
				return this.fb.group({
					...sourceId,
					type: [PluginSourceType.NPM],
					name: [
						'',
						[
							Validators.required,
							Validators.pattern(/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/)
						]
					],
					registry: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)],
					authToken: [''],
					scope: ['', Validators.pattern(/^@[a-z0-9-~][a-z0-9-._~]*$/)]
				});

			case PluginSourceType.GAUZY:
			default:
				return this.fb.group({
					...sourceId,
					type: [PluginSourceType.GAUZY],
					file: [null, Validators.required]
				});
		}
	}

	public reset(): void {
		this.initForm();
		this.formTouched = false;
	}

	public submit(): void {
		this.formTouched = true;

		if (this.pluginForm.invalid) {
			this.markFormGroupTouched(this.pluginForm);
			this.scrollToFirstInvalidControl();
			this.toastrService.error(this.translateService.instant('PLUGIN.FORM.VALIDATION.FAILED'));
			return;
		}

		this.isSubmitting = true;

		try {
			const pluginData = this.pluginForm.value;
			this.dialogRef.close(pluginData);
		} catch (error) {
			this.toastrService.error(error.message || error);
		} finally {
			this.isSubmitting = false;
		}
	}

	private setupSourceTypeListener(): void {
		this.pluginForm
			?.get('version.source.type')
			?.valueChanges.pipe(
				distinctUntilChange(),
				filter(Boolean),
				tap((type: PluginSourceType) => this.onSourceTypeChange(type)),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	public onSourceTypeChange(type: PluginSourceType): void {
		if (!this.pluginForm) return;
		const source = this.createSourceGroup(type);
		const versionControl = this.pluginForm.get('version') as FormGroup;

		if (versionControl && source) {
			if (versionControl.get('source')) {
				versionControl.removeControl('source');
			}
			versionControl.addControl('source', source);
		}
	}

	private scrollToFirstInvalidControl(): void {
		const firstInvalidControl = document.querySelector('form .ng-invalid');
		if (firstInvalidControl) {
			firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	private markFormGroupTouched(formGroup: FormGroup): void {
		Object.values(formGroup.controls).forEach((control) => {
			control.markAsTouched();
			control.markAsDirty();

			if (control instanceof FormGroup) {
				this.markFormGroupTouched(control);
			}
		});
	}

	public dismiss(): void {
		this.dialogRef.close();
	}

	public get isFormInvalid(): boolean {
		return this.pluginForm.invalid;
	}

	ngOnDestroy(): void {
		this.reset();
		this.destroy$.next();
		this.destroy$.complete();
	}
}
