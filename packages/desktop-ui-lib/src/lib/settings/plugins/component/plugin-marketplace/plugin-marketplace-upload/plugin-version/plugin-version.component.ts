import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'lib-plugin-version',
	templateUrl: './plugin-version.component.html',
	styleUrls: ['./plugin-version.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginVersionComponent {
	@Input() form: FormGroup;
	public today = new Date();

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.form.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}
}
