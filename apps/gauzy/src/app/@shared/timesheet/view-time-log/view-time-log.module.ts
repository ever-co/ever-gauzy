import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewTimeLogComponent } from './view-time-log.component';
import {
	NbListModule,
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbUserModule
} from '@nebular/theme';
import { SharedModule } from '../../shared.module';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';
import { ViewTimeLogModalModule } from '../view-time-log-modal/view-time-log-modal.module';

@NgModule({
	declarations: [ViewTimeLogComponent],
	entryComponents: [ViewTimeLogComponent],
	exports: [ViewTimeLogComponent],
	imports: [
		CommonModule,
		NbListModule,
		SharedModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		NbIconModule,
		NbUserModule
	]
})
export class ViewTimeLogModule {}
