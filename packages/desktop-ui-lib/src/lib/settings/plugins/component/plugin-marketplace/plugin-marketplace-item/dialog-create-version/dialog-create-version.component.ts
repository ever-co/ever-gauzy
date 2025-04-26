import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { IPlugin, IPluginVersion, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { NbDateService, NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, Subject, takeUntil, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';

@Component({
	selector: 'lib-dialog-create-version',
	templateUrl: './dialog-create-version.component.html',
	styleUrls: ['./dialog-create-version.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogCreateVersionComponent implements OnInit, OnDestroy {
	versionForm: FormGroup;
	plugin: IPlugin;
	version: IPluginVersion;
	pluginTypes = Object.values(PluginType);
	pluginStatuses = Object.values(PluginStatus);
	sourceTypes = Object.values(PluginSourceType);
	isSubmitting = false;
	formTouched = false;
	today: Date;
	destroy$ = new Subject<void>();

	constructor(
		private readonly fb: FormBuilder,
		private readonly dialogRef: NbDialogRef<DialogCreateVersionComponent>,
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
		this.versionForm = this.createVersionGroup();
	}

	private createVersionGroup(): FormGroup {
		return this.fb.group({
			...(this.version?.id && { id: this.version.id }),
			number: ['', [Validators.required, Validators.pattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)]],
			changelog: ['', [Validators.required, Validators.minLength(10)]],
			releaseDate: [this.today, [Validators.required, this.pastDateValidator()]],
			source: this.createSourceGroup(PluginSourceType.CDN)
		});
	}

	private patch(): void {
		if (!this.version) return;
		const version: Partial<IPluginVersion> = {
			...this.version,
			...(this.version.source && { source: { ...this.version.source } })
		}; //create a copy of the version

		if (version?.source?.type) {
			this.onSourceTypeChange(version.source.type);
		}

		this.versionForm.patchValue(version);
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
		const sourceId = this.version?.sourceId ? { id: this.version.sourceId } : {};
		switch (type) {
			case PluginSourceType.CDN:
				return this.fb.group({
					...sourceId,
					type: [PluginSourceType.CDN],
					url: [
						'',
						[
							Validators.required,
							Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})(\/[\w.-]*)*\/?$/)
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
					registry: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})(\/[\w.-]*)*\/?$/)],
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

		if (this.versionForm.invalid) {
			this.markFormGroupTouched(this.versionForm);
			this.scrollToFirstInvalidControl();
			this.toastrService.error(this.translateService.instant('PLUGIN.FORM.VALIDATION.FAILED'));
			return;
		}

		this.isSubmitting = true;

		try {
			const data = this.versionForm.value;
			this.dialogRef.close(data);
		} catch (error) {
			this.toastrService.error(error.message || error);
		} finally {
			this.isSubmitting = false;
		}
	}

	private setupSourceTypeListener(): void {
		this.versionForm
			?.get('source.type')
			?.valueChanges.pipe(
				distinctUntilChange(),
				filter(Boolean),
				tap((type: PluginSourceType) => this.onSourceTypeChange(type)),
				takeUntil(this.destroy$)
			)
			.subscribe();
	}

	public onSourceTypeChange(type: PluginSourceType): void {
		if (!this.versionForm) return;
		const source = this.createSourceGroup(type);
		if (source) {
			if (this.versionForm.get('source')) {
				this.versionForm.removeControl('source');
			}
			this.versionForm.addControl('source', source);
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
		return this.versionForm.invalid;
	}

	public get versionNumber(): string {
		return this.versionForm?.get('number')?.value;
	}

	ngOnDestroy(): void {
		this.reset();
		this.destroy$.next();
		this.destroy$.complete();
	}
}
