// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule, NbCheckboxModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { ViewRoutingModule } from './view-routing.module';
import { GithubViewComponent } from './view/view.component';
import { EditTimeLogModalModule } from './../../../../@shared/timesheet';
import { DialogsModule } from './../../../../@shared/dialogs';
import { SharedModule } from './../../../../@shared/shared.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { DateRangeTitleModule } from './../../../../@shared/components/date-range-title/date-range-title.module';
import { GauzyButtonActionModule } from 'apps/gauzy/src/app/@shared/gauzy-button-action/gauzy-button-action.module';

@NgModule({
	declarations: [GithubViewComponent],
	imports: [
		CommonModule,
		ViewRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild(),
		SharedModule,
		MomentModule,
		DialogsModule,
		EditTimeLogModalModule,
		DateRangeTitleModule,
		NbCheckboxModule,
		GauzyButtonActionModule
	]
})
export class ViewModule {}
