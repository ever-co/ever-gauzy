import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageViewerComponent } from './image-viewer.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbDialogModule,
	NbDialogService,
	NbButtonModule
} from '@nebular/theme';
import { dateTimePipe } from '../time-tracker/pipes/date-time.pipe';

@NgModule({
	declarations: [ImageViewerComponent, dateTimePipe],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbDialogModule,
		NbButtonModule
	],
	exports: [ImageViewerComponent],
	providers: [NbDialogService]
})
export class ImageViewerModule {}
