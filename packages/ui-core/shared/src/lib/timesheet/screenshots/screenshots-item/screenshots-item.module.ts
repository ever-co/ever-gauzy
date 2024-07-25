import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
	NbButtonModule,
	NbDialogModule,
	NbIconModule,
	NbCheckboxModule,
	NbProgressBarModule,
	NbPopoverModule,
	NbListModule,
	NbTooltipModule
} from '@nebular/theme';
import { MomentModule } from 'ngx-moment';
import { TranslateModule } from '@ngx-translate/core';
import { DialogsModule } from '../../../dialogs/dialogs.module';
import { TableComponentsModule } from '../../../table-components';
import { GalleryModule } from '../../../gallery/gallery.module';
import { ViewScreenshotsModalModule } from '../view-screenshots-modal/view-screenshots-modal.module';
import { SharedModule } from '../../../shared.module';
import { ScreenshotsItemComponent } from './screenshots-item.component';

@NgModule({
	declarations: [ScreenshotsItemComponent],
	exports: [ScreenshotsItemComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbButtonModule,
		NbCheckboxModule,
		NbDialogModule.forChild(),
		NbIconModule,
		NbListModule,
		NbPopoverModule,
		NbProgressBarModule,
		NbTooltipModule,
		MomentModule,
		TranslateModule.forChild(),
		SharedModule,
		DialogsModule,
		GalleryModule,
		TableComponentsModule,
		ViewScreenshotsModalModule
	]
})
export class ScreenshotsItemModule {}
