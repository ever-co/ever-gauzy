import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';

@Component({
	selector: 'lib-plugin-basic-information',
	templateUrl: './plugin-basic-information.component.html',
	styleUrls: ['./plugin-basic-information.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginBasicInformationComponent extends BasePluginFormComponent {
	@Input() pluginTypes: string[];
	@Input() pluginStatuses: string[];
}
