import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbCheckboxModule,
	NbProgressBarModule
} from '@nebular/theme';
import { ScreenshotsItemComponent } from './screenshots-item.component';
import { SharedModule } from '../../../shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MomentModule } from 'ngx-moment';
import { GalleryModule } from '../../../gallery/gallery.module';
import { ViewTimeLogModalModule } from '../../view-time-log-modal/view-time-log-modal.module';

@NgModule({
	declarations: [ScreenshotsItemComponent],
	exports: [ScreenshotsItemComponent],
	imports: [
		CommonModule,
		SharedModule,
		NbButtonModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbCheckboxModule,
		TranslateModule,
		NbProgressBarModule,
		FormsModule,
		ReactiveFormsModule,
		MomentModule,
		GalleryModule,
		ViewTimeLogModalModule
	]
})
export class ScreenshotsItemModule {}
