import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewScreenshotsModalComponent } from './view-screenshots-modal.component';
import {
	NbDialogModule,
	NbCardModule,
	NbButtonModule,
	NbIconModule,
	NbProgressBarModule
} from '@nebular/theme';
import { SharedModule } from '../../../shared.module';
import { MomentModule } from 'ngx-moment';
import { TranslateModule } from '@ngx-translate/core';
import { LabelModule } from '../../../components/label/label.module';
import { GalleryModule } from '../../../gallery/gallery.module';

@NgModule({
	declarations: [ViewScreenshotsModalComponent],
	exports: [ViewScreenshotsModalComponent],
	imports: [
		CommonModule,
		NbDialogModule.forChild(),
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		SharedModule,
		NbProgressBarModule,
		MomentModule,
		TranslateModule,
		LabelModule,
		GalleryModule
	]
})
export class ViewScreenshotsModalModule {}
