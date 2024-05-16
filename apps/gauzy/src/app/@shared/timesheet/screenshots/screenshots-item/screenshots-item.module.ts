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
import { GalleryModule } from '../../../gallery/gallery.module';
import { DialogsModule } from '../../../dialogs/dialogs.module';
import { ViewScreenshotsModalModule } from '../view-screenshots-modal/view-screenshots-modal.module';
import { TableComponentsModule } from '../../../table-components/table-components.module';
import { SharedModule } from '../../../shared.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
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
		TranslateModule,
		SharedModule,
		DialogsModule,
		GalleryModule,
		TableComponentsModule,
		ViewScreenshotsModalModule
	]
})
export class ScreenshotsItemModule {}
