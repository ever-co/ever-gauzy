import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { IPlugin, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDialogRef, NbStepperComponent, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, Subject, takeUntil } from 'rxjs';

@Component({
	selector: 'lib-plugin-marketplace-upload',
	templateUrl: './plugin-marketplace-upload.component.html',
	styleUrls: ['./plugin-marketplace-upload.component.scss'],
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
	today = new Date(new Date().setHours(0, 0, 0, 0)); // Ensures a proper date comparison
	destroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<PluginMarketplaceUploadComponent>,
		private readonly cdr: ChangeDetectorRef,
		private readonly toastrService: NbToastrService,
		private readonly translateService: TranslateService
	) {}

	ngOnInit(): void {
		this.initForm();
		this.setupSourceTypeListener();
		this.patch();
	}

	private initForm(): void {
		this.pluginForm = this.fb.group({
			name: ['', [Validators.required, Validators.maxLength(100)]],
			description: ['', Validators.maxLength(500)],
			type: [PluginType.DESKTOP, Validators.required],
			status: [PluginStatus.ACTIVE, Validators.required],
			version: this.createVersionGroup(),
			source: this.createSourceGroup(PluginSourceType.CDN),
			author: ['', Validators.maxLength(100)],
			license: ['', Validators.maxLength(50)],
			homepage: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)],
			repository: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)]
		});
	}

	private patch(): void {
		if (!this.plugin) return;

		const { name, description, type, status, versions, version, source, author, license, homepage, repository } =
			this.plugin;

		this.pluginForm.patchValue({
			name,
			description,
			type,
			status,
			author,
			license,
			homepage,
			repository
		});

		if (source) {
			this.pluginForm.get('source')?.patchValue(source);
		}

		if (versions && version) {
			this.pluginForm.get('version')?.patchValue(version);
		}

		this.cdr.detectChanges();
	}

	private createVersionGroup(): FormGroup {
		return this.fb.group({
			number: ['', [Validators.required, Validators.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)]],
			changelog: ['', [Validators.required, Validators.minLength(10)]],
			releaseDate: [this.today, [Validators.required, this.pastDateValidator()]]
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

	private createSourceGroup(type: string): FormGroup {
		switch (type) {
			case PluginSourceType.CDN:
				return this.fb.group({
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
					type: [PluginSourceType.GAUZY],
					file: [null, Validators.required]
				});
		}
	}

	public reset(): void {
		this.initForm();
		this.formTouched = false;
		this.cdr.markForCheck();
	}

	public submit(): void {
		this.formTouched = true;

		if (this.pluginForm.invalid) {
			this.markFormGroupTouched(this.pluginForm);
			this.scrollToFirstInvalidControl();
			this.toastrService.danger(
				this.translateService.instant('PLUGINS.VALIDATION.FORM_INVALID'),
				this.translateService.instant('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this.isSubmitting = true;
		this.cdr.markForCheck();

		try {
			const pluginData = this.pluginForm.value;
			this.toastrService.success(
				this.translateService.instant('PLUGINS.UPLOAD.SUCCESS'),
				this.translateService.instant('TOASTR.TITLE.SUCCESS')
			);
			this.dialogRef.close(pluginData);
		} catch (error) {
			this.toastrService.danger(
				error.message || this.translateService.instant('PLUGINS.UPLOAD.ERROR'),
				this.translateService.instant('TOASTR.TITLE.ERROR')
			);
		} finally {
			this.isSubmitting = false;
			this.cdr.detectChanges();
		}
	}

	private setupSourceTypeListener(): void {
		this.pluginForm
			?.get('source.type')
			?.valueChanges.pipe(distinctUntilChange(), filter(Boolean), debounceTime(300), takeUntil(this.destroy$))
			.subscribe((type: PluginType) => this.onSourceTypeChange(type));
	}

	public onSourceTypeChange(type: PluginType): void {
		if (!this.pluginForm) return;
		const source = this.createSourceGroup(type);
		if (!source) return;
		this.pluginForm.setControl('source', source);
		this.cdr.markForCheck();
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
