import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PluginSourceType, PluginStatus, PluginType } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'lib-plugin-marketplace-upload',
	templateUrl: './plugin-marketplace-upload.component.html',
	styleUrl: './plugin-marketplace-upload.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMarketplaceUploadComponent implements OnInit {
	pluginForm: FormGroup;
	pluginTypes = Object.values(PluginType);
	pluginStatuses = Object.values(PluginStatus);
	sourceTypes = Object.values(PluginSourceType);
	selectedFile: File | null = null;
	errorMessage: string | null = null;
	isDragOver = false;
	private maxFileSize = 1024 * 1024 * 1024; // 1GB

	constructor(private fb: FormBuilder, private dialogRef: NbDialogRef<PluginMarketplaceUploadComponent>) {}

	ngOnInit(): void {
		this.initForm();
	}

	private initForm(): void {
		this.pluginForm = this.fb.group({
			name: ['', Validators.required],
			description: [''],
			type: [this.pluginTypes[0]],
			status: [this.pluginStatuses[0]],
			version: ['', Validators.required],
			sourceType: [this.sourceTypes[0]],
			source: this.createSourceGroup(this.sourceTypes[0]),
			author: [''],
			license: [''],
			homepage: [''],
			repository: ['']
		});
	}

	private createSourceGroup(type: string): FormGroup {
		switch (type) {
			case PluginSourceType.CDN:
				return this.fb.group({
					type: PluginSourceType.CDN,
					url: ['', Validators.required],
					integrity: [''],
					crossOrigin: ['']
				});

			case PluginSourceType.NPM:
				return this.fb.group({
					type: PluginSourceType.NPM,
					name: ['', Validators.required],
					registry: [''],
					authToken: [''],
					scope: ['']
				});

			case PluginSourceType.GAUZY:
				return this.fb.group({
					type: PluginSourceType.GAUZY,
					file: [null]
				});

			default:
				throw new Error(`Unsupported plugin source type: ${type}`);
		}
	}

	public onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;

		if (input.files && input.files.length > 0) {
			this.processFile(input.files[0]);
		}
	}
	public onDragEnter(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.isDragOver = true;
	}

	public onDragOver(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.isDragOver = true;
	}

	public onDragLeave(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.isDragOver = false;
	}

	public onDrop(event: DragEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.isDragOver = false;

		if (event.dataTransfer && event.dataTransfer.files.length > 0) {
			this.processFile(event.dataTransfer.files[0]);
		}
	}

	private processFile(file: File): void {
		const sourceGroup = this.pluginForm.get('source') as FormGroup;

		// Validate file type
		if (!file.name.endsWith('.zip')) {
			this.errorMessage = 'Only ZIP files are allowed.';
			sourceGroup.get('file').setErrors({ invalidType: true });
			this.selectedFile = null;

			return;
		}

		// Validate file size
		if (file.size > this.maxFileSize) {
			this.errorMessage = 'File size must be less than 1GB.';
			sourceGroup.get('file').setErrors({ maxSizeExceeded: true });
			this.selectedFile = null;

			return;
		}

		this.selectedFile = file;
		this.errorMessage = null;
		sourceGroup.patchValue({ file });
	}

	public removeFile(event: Event): void {
		event.stopPropagation();
		const sourceGroup = this.pluginForm.get('source') as FormGroup;
		sourceGroup.patchValue({ file: null });
		this.selectedFile = null;
		this.errorMessage = null;
	}

	public formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	public onSourceTypeChange(type: string): void {
		this.pluginForm.setControl('source', this.createSourceGroup(type));
		this.selectedFile = null;
		this.errorMessage = null;
	}

	public submit(): void {
		if (this.pluginForm.valid) {
			const pluginData = this.pluginForm.value;
			this.dialogRef.close(pluginData);
		}
	}

	public dismiss(): void {
		this.dialogRef.close();
	}
}
