import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';

@Component({
	selector: 'lib-plugin-metadata',
	templateUrl: './plugin-metadata.component.html',
	styleUrls: ['./plugin-metadata.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginMetadataComponent extends BasePluginFormComponent {}
