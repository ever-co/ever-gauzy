import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PluginOSArch, PluginOSType, PluginSourceType } from '@gauzy/contracts';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';

@Component({
	selector: 'lib-plugin-source',
	templateUrl: './plugin-source.component.html',
	styleUrls: ['./plugin-source.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginSourceComponent extends BasePluginFormComponent {
	public readonly pluginSourceType = PluginSourceType;
	public readonly sourceTypes = Object.values(PluginSourceType);
	public readonly sourceArchs = Object.values(PluginOSArch);
	public readonly sourceOs = Object.values(PluginOSType);
}
