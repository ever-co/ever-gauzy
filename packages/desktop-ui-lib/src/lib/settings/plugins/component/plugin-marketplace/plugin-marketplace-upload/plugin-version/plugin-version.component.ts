import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { NbDateService } from '@nebular/theme';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';

@Component({
	selector: 'lib-plugin-version',
	templateUrl: './plugin-version.component.html',
	styleUrls: ['./plugin-version.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginVersionComponent extends BasePluginFormComponent {
	@Input() isEdit = false;
	@Input() pluginId: ID;

	public max: Date;

	constructor(protected dateService: NbDateService<Date>) {
		super();
		this.max = dateService.today();
	}
}
