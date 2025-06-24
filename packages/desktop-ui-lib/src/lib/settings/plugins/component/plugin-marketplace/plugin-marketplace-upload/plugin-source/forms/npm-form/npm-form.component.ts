import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BasePluginFormComponent } from '../../../base-plugin-form/base-plugin-form.component';

@Component({
	selector: 'lib-npm-form',
	standalone: false,
	templateUrl: './npm-form.component.html',
	styleUrl: './npm-form.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NpmFormComponent extends BasePluginFormComponent {}
