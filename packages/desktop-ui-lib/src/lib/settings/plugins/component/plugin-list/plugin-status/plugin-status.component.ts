import { Component } from '@angular/core';
import { NbBadgeModule } from '@nebular/theme';
import { TitleCasePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'ngx-plugin-status',
    templateUrl: './plugin-status.component.html',
    styleUrls: ['./plugin-status.component.scss'],
    imports: [NbBadgeModule, TitleCasePipe, TranslatePipe]
})
export class PluginStatusComponent {
	public rowData: any;

	public get state() {
		return this.rowData.isActivate
			? { message: 'PLUGIN.FORM.STATUSES.ACTIVE', status: 'success' }
			: { message: 'PLUGIN.FORM.STATUSES.INACTIVE', status: 'danger' };
	}
}
