import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { NbDateService } from '@nebular/theme';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';
import { ID } from '@gauzy/contracts';

@Component({
	selector: 'lib-plugin-version',
	templateUrl: './plugin-version.component.html',
	styleUrls: ['./plugin-version.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginVersionComponent extends BasePluginFormComponent {
	@Input() form: FormGroup;
	@Input() isEdit = false;
	@Input() pluginId: ID;

	public max: Date;

	constructor(protected dateService: NbDateService<Date>) {
		super();
		this.max = dateService.today();
	}
}
