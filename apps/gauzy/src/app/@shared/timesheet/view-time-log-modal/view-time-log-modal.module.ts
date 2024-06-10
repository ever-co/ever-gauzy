import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbButtonModule, NbDialogModule, NbIconModule, NbAlertModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DialogsModule, TableComponentsModule } from '@gauzy/ui-sdk/shared';
import { ViewTimeLogModalComponent } from './view-time-log-modal.component';
import { SharedModule } from '../../shared.module';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';

@NgModule({
	declarations: [ViewTimeLogModalComponent],
	exports: [ViewTimeLogModalComponent],
	imports: [
		CommonModule,
		I18nTranslateModule.forChild(),
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
