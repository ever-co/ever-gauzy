import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { NbDateService } from '@nebular/theme';

@Component({
	selector: 'lib-plugin-version',
	templateUrl: './plugin-version.component.html',
	styleUrls: ['./plugin-version.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginVersionComponent {
	@Input() form: FormGroup;
	public max: Date;

	constructor(protected dateService: NbDateService<Date>) {
		this.max = dateService.today();
	}

	public getFieldError(controlName: string, errorType?: string): boolean {
		const control = this.form.get(controlName);
		if (!control) return false;

		if (errorType) {
			return control.touched && control.hasError(errorType);
		}

		return control.touched && control.invalid;
	}
}
