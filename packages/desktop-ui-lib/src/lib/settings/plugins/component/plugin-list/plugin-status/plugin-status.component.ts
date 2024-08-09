import { Component } from '@angular/core';

@Component({
	selector: 'ngx-plugin-status',
	templateUrl: './plugin-status.component.html',
	styleUrls: ['./plugin-status.component.scss']
})
export class PluginStatusComponent {
	public rowData: any;

	public get state() {
		return this.rowData.isActivate
			? { message: 'active', status: 'success' }
			: { message: 'inactive', status: 'danger' };
	}
}
