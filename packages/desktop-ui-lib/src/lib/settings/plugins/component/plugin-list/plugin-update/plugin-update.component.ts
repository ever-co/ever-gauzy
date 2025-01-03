import { Component } from '@angular/core';

@Component({
    selector: 'ngx-plugin-update',
    templateUrl: './plugin-update.component.html',
    styleUrls: ['./plugin-update.component.scss'],
    standalone: false
})
export class PluginUpdateComponent {
	public rowData: any;

	public get lastUpdate() {
		return this.rowData.updatedAt;
	}
}
