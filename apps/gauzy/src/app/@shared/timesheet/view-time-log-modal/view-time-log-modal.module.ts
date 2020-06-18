import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewTimeLogModalComponent } from './view-time-log-modal/view-time-log-modal.component';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import {
	NbCardModule,
	NbButtonModule,
	NbDialogModule,
	NbIconModule
} from '@nebular/theme';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';

@NgModule({
	declarations: [ViewTimeLogModalComponent],
	entryComponents: [ViewTimeLogModalComponent],
	exports: [ViewTimeLogModalComponent],
	imports: [
		CommonModule,
		TranslateModule,
		SharedModule,
		NbCardModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		EditTimeLogModalModule,
		NbIconModule
	]
})
export class ViewTimeLogModalModule {}
