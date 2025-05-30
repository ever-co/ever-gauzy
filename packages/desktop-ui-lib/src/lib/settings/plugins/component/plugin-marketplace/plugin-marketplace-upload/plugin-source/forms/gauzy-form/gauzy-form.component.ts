import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BasePluginFormComponent } from '../../../base-plugin-form/base-plugin-form.component';

@Component({
	selector: 'lib-gauzy-form',
	standalone: false,
	templateUrl: './gauzy-form.component.html',
	styleUrl: './gauzy-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class GauzyFormComponent extends BasePluginFormComponent {
	public onFileSelected(file: File | null): void {
		this.form.patchValue({
			file
		});
		this.form.markAsTouched();
		this.form.markAsDirty();
	}

	public removeFile(): void {
		this.onFileSelected(null);
	}
}
