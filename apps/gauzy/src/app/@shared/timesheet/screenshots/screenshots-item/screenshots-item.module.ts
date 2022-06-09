import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbCheckboxModule,
	NbProgressBarModule,
	NbPopoverModule,
	NbListModule
} from '@nebular/theme';
import { ScreenshotsItemComponent } from './screenshots-item.component';
import { SharedModule } from '../../../shared.module';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MomentModule } from 'ngx-moment';
import { GalleryModule } from '../../../gallery/gallery.module';
import { DialogsModule } from '../../../dialogs';
import { ViewScreenshotsModalModule } from '../view-screenshots-modal/view-screenshots-modal.module';
import { TableComponentsModule } from '../../../table-components';

@NgModule({
	declarations: [ScreenshotsItemComponent],
	exports: [ScreenshotsItemComponent],
	imports: [
		CommonModule,
		DialogsModule,
		FormsModule,
		GalleryModule,
		MomentModule,
		NbButtonModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbListModule,
		NbPopoverModule,
		NbProgressBarModule,
		ReactiveFormsModule,
		SharedModule,
		TableComponentsModule,
		TranslateModule,
		ViewScreenshotsModalModule
	]
})
export class ScreenshotsItemModule {}
