// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DialogsModule, GauzyButtonActionModule } from '@gauzy/ui-sdk/shared';
import { ViewRoutingModule } from './view-routing.module';
import { GithubViewComponent } from './view/view.component';
import { EditTimeLogModalModule } from './../../../../@shared/timesheet';
import { SharedModule } from './../../../../@shared/shared.module';

@NgModule({
	declarations: [GithubViewComponent],
	imports: [
		CommonModule,
		ViewRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		I18nTranslateModule.forChild(),
		SharedModule,
		MomentModule,
		DialogsModule,
		EditTimeLogModalModule,
		NbCheckboxModule,
		GauzyButtonActionModule
	]
})
export class ViewModule {}
