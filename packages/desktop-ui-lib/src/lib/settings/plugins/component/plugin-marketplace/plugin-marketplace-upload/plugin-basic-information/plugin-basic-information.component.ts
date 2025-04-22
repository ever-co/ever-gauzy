import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'lib-plugin-basic-information',
	templateUrl: './plugin-basic-information.component.html',
	styleUrls: ['./plugin-basic-information.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginBasicInformationComponent {
	@Input() form: FormGroup;
	@Input() pluginTypes: string[];
	@Input() pluginStatuses: string[];

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.form.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}
}
