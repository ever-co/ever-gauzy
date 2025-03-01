import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PluginStatus, PluginType } from '@gauzy/contracts';
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
	sourceTypes = ['CDN', 'NPM'];

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
		if (type === 'CDN') {
			return this.fb.group({
				type: 'CDN',
				url: ['', Validators.required],
				integrity: [''],
				crossOrigin: ['']
			});
		} else {
			return this.fb.group({
				type: 'NPM',
				name: ['', Validators.required],
				registry: [''],
				authToken: [''],
				scope: ['']
			});
		}
	}

	public onSourceTypeChange(type: string): void {
		this.pluginForm.setControl('source', this.createSourceGroup(type));
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
