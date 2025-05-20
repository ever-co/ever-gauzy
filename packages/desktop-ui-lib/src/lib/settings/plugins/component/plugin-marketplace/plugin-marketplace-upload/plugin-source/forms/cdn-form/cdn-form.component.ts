import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BasePluginFormComponent } from '../../../base-plugin-form/base-plugin-form.component';
@Component({
	selector: 'lib-cdn-form',
	standalone: false,
	templateUrl: './cdn-form.component.html',
	styleUrl: './cdn-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class CdnFormComponent extends BasePluginFormComponent {}
