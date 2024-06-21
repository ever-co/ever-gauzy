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
import { NgxPermissionsModule } from 'ngx-permissions';
import { MomentModule } from 'ngx-moment';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { DialogsModule } from '../../../dialogs/dialogs.module';
import { TableComponentsModule } from '../../../table-components';
import { SharedModule } from '../../../shared.module';
import { GalleryModule } from '../../../gallery/gallery.module';
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
		NgxPermissionsModule.forChild(),
		I18nTranslateModule.forChild(),
		DialogsModule,
		GalleryModule,
		TableComponentsModule
	]
})
export class ViewScreenshotsModalModule {}
