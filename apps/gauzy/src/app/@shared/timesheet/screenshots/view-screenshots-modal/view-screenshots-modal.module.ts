import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbAlertModule,
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbIconModule,
	NbProgressBarModule,
	NbTooltipModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { DialogsModule } from '@gauzy/ui-sdk/shared';
import { SharedModule } from '../../../shared.module';
import { GalleryModule } from '../../../gallery/gallery.module';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
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
		I18nTranslateModule.forChild(),
		DialogsModule,
		GalleryModule,
		TableComponentsModule
	]
})
export class ViewScreenshotsModalModule {}
