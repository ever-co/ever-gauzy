import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
    selector: 'ngx-plugin-update',
    templateUrl: './plugin-update.component.html',
    styleUrls: ['./plugin-update.component.scss'],
    imports: [DatePipe]
})
export class PluginUpdateComponent {
	public rowData: any;

	public get lastUpdate() {
		return this.rowData.updatedAt;
	}
}
