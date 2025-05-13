import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'lib-plugin-source',
	templateUrl: './plugin-source.component.html',
	styleUrls: ['./plugin-source.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginSourceComponent {
	@Input() form: FormGroup;
	@Input() sourceTypes: string[];

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.form.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}

	public onFileSelected(file: File): void {
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
