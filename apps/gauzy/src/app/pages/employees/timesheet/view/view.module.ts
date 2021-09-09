// tslint:disable: nx-enforce-module-boundaries
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { ViewRoutingModule } from './view-routing.module';
import { ViewComponent } from './view/view.component';
import { EditTimeLogModalModule } from './../../../../@shared/timesheet';
import { DialogsModule } from './../../../../@shared/dialogs';
import { SharedModule } from './../../../../@shared/shared.module';
import { TranslateModule } from './../../../../@shared/translate/translate.module';

@NgModule({
	declarations: [ViewComponent],
	imports: [
		CommonModule,
		ViewRoutingModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule,
		SharedModule,
		MomentModule,
		DialogsModule,
		EditTimeLogModalModule
	]
})
export class ViewModule {}
