import { Component } from '@angular/core';

@Component({
    selector: 'ngx-plugin-status',
    templateUrl: './plugin-status.component.html',
    styleUrls: ['./plugin-status.component.scss'],
    standalone: false
})
export class PluginStatusComponent {
	public rowData: any;

	public get state() {
		return this.rowData.isActivate
			? { message: 'PLUGIN.FORM.STATUSES.ACTIVE', status: 'success' }
			: { message: 'PLUGIN.FORM.STATUSES.INACTIVE', status: 'danger' };
	}
}
