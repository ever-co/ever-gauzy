import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogModule, NbIconModule, NbAlertModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { DialogsModule } from '../../dialogs/dialogs.module';
import { TableComponentsModule } from '../../table-components';
import { ViewTimeLogModalComponent } from './view-time-log-modal.component';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';

@NgModule({
	declarations: [ViewTimeLogModalComponent],
	exports: [ViewTimeLogModalComponent],
	imports: [
		CommonModule,
		TranslateModule.forChild(),
		SharedModule,
		NbCardModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		EditTimeLogModalModule,
		NbIconModule,
		DialogsModule,
		NbAlertModule,
		TableComponentsModule
	]
})
export class ViewTimeLogModalModule {}
