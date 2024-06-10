import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { DialogsModule } from '@gauzy/ui-sdk/shared';
import { ViewTimeLogModalComponent } from './view-time-log-modal.component';
import { SharedModule } from '../../shared.module';
import { NbCardModule, NbButtonModule, NbDialogModule, NbIconModule, NbAlertModule } from '@nebular/theme';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';
import { TableComponentsModule } from '../../table-components';

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
