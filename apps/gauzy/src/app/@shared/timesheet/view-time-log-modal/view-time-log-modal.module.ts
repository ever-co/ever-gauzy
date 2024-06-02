import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewTimeLogModalComponent } from './view-time-log-modal.component';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { NbCardModule, NbButtonModule, NbDialogModule, NbIconModule, NbAlertModule } from '@nebular/theme';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';
import { DialogsModule } from '../../dialogs';
import { LabelModule } from '../../components/label/label.module';
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
		LabelModule,
		NbAlertModule,
		TableComponentsModule
	]
})
export class ViewTimeLogModalModule {}
