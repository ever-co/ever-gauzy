import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewTimeLogComponent } from './view-time-log.component';
import {
	NbListModule,
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbUserModule,
	NbTooltipModule
} from '@nebular/theme';
import { SharedModule } from '../../shared.module';
import { EditTimeLogModalModule } from '../edit-time-log-modal/edit-time-log-modal.module';
import { ViewTimeLogModalModule } from '../view-time-log-modal/view-time-log-modal.module';
import { DialogsModule } from '../../dialogs';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';

@NgModule({
	declarations: [ViewTimeLogComponent],
	exports: [ViewTimeLogComponent],
	imports: [
		CommonModule,
		NbListModule,
		SharedModule,
		NbButtonModule,
		NbTooltipModule,
		NbDialogModule.forChild(),
		EditTimeLogModalModule,
		ViewTimeLogModalModule,
		NbIconModule,
		NbUserModule,
		DialogsModule,
		I18nTranslateModule.forChild()
	]
})
export class ViewTimeLogModule {}
