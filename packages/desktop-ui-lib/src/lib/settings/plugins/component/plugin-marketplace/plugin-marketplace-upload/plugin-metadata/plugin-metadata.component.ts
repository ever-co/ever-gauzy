import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'lib-plugin-metadata',
	templateUrl: './plugin-metadata.component.html',
	styleUrls: ['./plugin-metadata.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMetadataComponent {
	@Input() form: FormGroup;

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.form.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}
}
