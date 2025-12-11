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

	/**
	 * Get badge color based on plugin status
	 */
	getStatusBadgeColor(status: string): string {
		const statusColorMap: Record<string, string> = {
			active: 'success',
			inactive: 'warning',
			deprecated: 'danger',
			beta: 'info',
			alpha: 'basic'
		};
		return statusColorMap[status?.toLowerCase()] || 'basic';
	}

	/**
	 * Get hint color based on plugin status
	 */
	getStatusHintColor(status: string): string {
		const statusHintMap: Record<string, string> = {
			active: 'success',
			inactive: 'warning',
			deprecated: 'danger',
			beta: 'info',
			alpha: 'basic'
		};
		return statusHintMap[status?.toLowerCase()] || 'basic';
	}
}
