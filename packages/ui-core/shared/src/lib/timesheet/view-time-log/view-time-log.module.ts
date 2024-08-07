import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbListModule,
	NbTooltipModule,
	NbUserModule
} from '@nebular/theme';
import { NgxPermissionsModule } from 'ngx-permissions';
import { TranslateModule } from '@ngx-translate/core';
import { DialogsModule } from '../../dialogs/dialogs.module';
import { SharedModule } from '../../shared.module';
import { ViewTimeLogComponent } from './view-time-log.component';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';
import { ViewTimeLogModalModule } from '../view-time-log-modal/view-time-log-modal.module';

@NgModule({
	declarations: [ViewTimeLogComponent],
	exports: [ViewTimeLogComponent],
	imports: [
		CommonModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbListModule,
		NbTooltipModule,
		NbUserModule,
		NgxPermissionsModule,
		TranslateModule.forChild(),
		SharedModule,
		DialogsModule,
		EditTimeLogModalModule,
		ViewTimeLogModalModule
	]
})
export class ViewTimeLogModule {}
