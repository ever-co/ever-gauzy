import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbDialogModule,
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbProgressBarModule,
	NbAlertModule,
	NbTooltipModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { SharedModule } from '../../../shared.module';
import { LabelModule } from '../../../components/label/label.module';
import { GalleryModule } from '../../../gallery/gallery.module';
import { DialogsModule } from '../../../dialogs/dialogs.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { TableComponentsModule } from '../../../table-components/table-components.module';
import { ViewScreenshotsModalComponent } from './view-screenshots-modal.component';

@NgModule({
	declarations: [ViewScreenshotsModalComponent],
	exports: [ViewScreenshotsModalComponent],
	imports: [
		CommonModule,
		NbAlertModule,
		NbButtonModule,
		NbCardModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbProgressBarModule,
		NbTooltipModule,
		MomentModule,
		SharedModule,
		TranslateModule,
		LabelModule,
		GalleryModule,
		DialogsModule,
		TableComponentsModule
	]
})
export class ViewScreenshotsModalModule {}
