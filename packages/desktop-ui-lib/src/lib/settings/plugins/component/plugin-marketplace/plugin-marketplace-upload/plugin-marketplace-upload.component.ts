import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin, PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
	selector: 'lib-plugin-marketplace-upload',
	templateUrl: './plugin-marketplace-upload.component.html',
	styleUrls: ['./plugin-marketplace-upload.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceUploadComponent implements OnInit {
	@ViewChild('fileInput') fileInput: ElementRef;

	pluginForm: FormGroup;
	plugin: IPlugin;
	pluginTypes = Object.values(PluginType);
	pluginStatuses = Object.values(PluginStatus);
	sourceTypes = Object.values(PluginSourceType);
	selectedFile: File | null = null;
	errorMessage: string | null = null;
	isDragOver = false;
	isSubmitting = false;
	formTouched = false;

	readonly ALLOWED_EXTENSIONS = ['.zip'];
	readonly MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
	private readonly destroy$ = new Subject<void>();

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

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private initForm(): void {
		this.pluginForm = this.fb.group({
			name: ['', [Validators.required, Validators.maxLength(100)]],
			description: ['', Validators.maxLength(500)],
			type: [this.pluginTypes[0], Validators.required],
			status: [this.pluginStatuses[0], Validators.required],
			version: ['', [Validators.required, Validators.pattern(/^\d+\.\d+\.\d+$/)]],
			sourceType: [this.sourceTypes[0], Validators.required],
			source: this.createSourceGroup(this.sourceTypes[0]),
			author: ['', Validators.maxLength(100)],
			license: ['', Validators.maxLength(50)],
			homepage: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)],
			repository: ['', Validators.pattern(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)]
		});
	}

	private patch(): void {
		if (!this.plugin) return;

		const { name, description, type, status, versions, source, author, license, homepage, repository } =
			this.plugin;
		const { type: sourceType } = source;

		this.pluginForm.patchValue({
			name,
			description,
			type,
			status,
			version: versions[0],
			sourceType,
			source: this.createSourceGroup(sourceType),
			author,
			license,
			homepage,
			repository
		});

		const sourcePatch: Record<string, any> = {};

		if (sourceType === PluginSourceType.CDN) {
			Object.assign(sourcePatch, {
				url: source.url,
				integrity: source.integrity,
				crossOrigin: source.crossOrigin
			});
		} else if (sourceType === PluginSourceType.NPM) {
			Object.assign(sourcePatch, {
				name,
				version: versions[0],
				scope: source.scope
			});
		}

		if (Object.keys(sourcePatch).length > 0) {
			this.pluginForm.get('source')?.patchValue(sourcePatch);
		}

		this.cdr.markForCheck();
	}

	private setupSourceTypeListener(): void {
		this.pluginForm
			.get('sourceType')
			?.valueChanges.pipe(takeUntil(this.destroy$))
			.subscribe((type) => this.onSourceTypeChange(type));
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
				return this.fb.group({
					type: [PluginSourceType.GAUZY],
					file: [null, Validators.required]
				});

			default:
				throw new Error(`Unsupported plugin source type: ${type}`);
		}
	}

	public onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;

		if (input.files && input.files.length > 0) {
			this.processFile(input.files[0]);
			this.cdr.markForCheck();
		}
	}

	public onDragEnter(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = true;
		this.cdr.markForCheck();
	}

	public onDragOver(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = true;
	}

	public onDragLeave(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = false;
		this.cdr.markForCheck();
	}

	public onDrop(event: DragEvent): void {
		this.preventDefault(event);
		this.isDragOver = false;

		if (event.dataTransfer?.files.length > 0) {
			this.processFile(event.dataTransfer.files[0]);
			this.cdr.markForCheck();
		}
	}

	private preventDefault(event: Event): void {
		event.preventDefault();
		event.stopPropagation();
	}

	private processFile(file: File): void {
		const sourceGroup = this.pluginForm.get('source') as FormGroup;
		const fileControl = sourceGroup.get('file');

		// Reset previous errors
		this.errorMessage = null;
		fileControl?.setErrors(null);

		// Validate file extension
		const fileExtension = this.getFileExtension(file.name);
		if (!this.ALLOWED_EXTENSIONS.includes(fileExtension)) {
			this.errorMessage = this.translateService.instant('PLUGINS.FILE_VALIDATION.INVALID_TYPE', {
				extensions: this.ALLOWED_EXTENSIONS.join(', ')
			});
			fileControl?.setErrors({ invalidType: true });
			this.selectedFile = null;
			return;
		}

		// Validate file size
		if (file.size > this.MAX_FILE_SIZE) {
			this.errorMessage = this.translateService.instant('PLUGINS.FILE_VALIDATION.MAX_SIZE_EXCEEDED', {
				maxSize: this.formatFileSize(this.MAX_FILE_SIZE)
			});
			fileControl?.setErrors({ maxSizeExceeded: true });
			this.selectedFile = null;
			return;
		}

		this.selectedFile = file;
		fileControl?.setValue(file);
	}

	private getFileExtension(filename: string): string {
		return filename.substring(filename.lastIndexOf('.')).toLowerCase();
	}

	public removeFile(event: Event): void {
		this.preventDefault(event);
		const sourceGroup = this.pluginForm.get('source') as FormGroup;
		sourceGroup.get('file')?.setValue(null);
		this.selectedFile = null;
		this.errorMessage = null;
		this.cdr.markForCheck();
	}

	public formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	}

	public onSourceTypeChange(type: string): void {
		this.pluginForm.setControl('source', this.createSourceGroup(type));
		this.selectedFile = null;
		this.errorMessage = null;
		this.cdr.markForCheck();
	}

	public reset(): void {
		this.initForm();
		this.selectedFile = null;
		this.errorMessage = null;
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

		try {
			this.isSubmitting = true;
			this.cdr.markForCheck();

			const pluginData = this.pluginForm.value;

			// Add success notification
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
			this.cdr.markForCheck();
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

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.pluginForm.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}

	public getSourceFieldError(fieldName: string, errorType?: string): boolean {
		const sourceGroup = this.pluginForm.get('source') as FormGroup;
		if (!sourceGroup) return false;

		const control = sourceGroup.get(fieldName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}

	public triggerFileBrowse(): void {
		this.fileInput?.nativeElement.click();
	}
}
