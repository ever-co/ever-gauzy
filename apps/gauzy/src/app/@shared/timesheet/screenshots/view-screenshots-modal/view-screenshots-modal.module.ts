import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewScreenshotsModalComponent } from './view-screenshots-modal.component';
import {
	NbDialogModule,
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbProgressBarModule,
	NbAlertModule
} from '@nebular/theme';
import { SharedModule } from '../../../shared.module';
import { MomentModule } from 'ngx-moment';
import { TranslateModule } from '@ngx-translate/core';
import { LabelModule } from '../../../components/label/label.module';
import { GalleryModule } from '../../../gallery/gallery.module';
import { DialogsModule } from '../../../dialogs/dialogs.module';

@NgModule({
	declarations: [ViewScreenshotsModalComponent],
	exports: [ViewScreenshotsModalComponent],
	imports: [
		CommonModule,
		NbAlertModule,
		NbDialogModule.forChild(),
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		SharedModule,
		NbProgressBarModule,
		MomentModule,
		TranslateModule,
		LabelModule,
		GalleryModule,
    	DialogsModule
	]
})
export class ViewScreenshotsModalModule {}
