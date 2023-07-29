import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageViewerComponent } from './image-viewer.component';
import {
	NbLayoutModule,
	NbCardModule,
	NbIconModule,
	NbDialogModule,
	NbDialogService,
	NbButtonModule,
	NbSpinnerModule
} from '@nebular/theme';
import { dateTimePipe } from '../time-tracker/pipes/date-time.pipe';
import { ImageViewerService } from './image-viewer.service';
import { ImageCacheService, StorageService, Store } from '../services';
import { NbEvaIconsModule } from '@nebular/eva-icons';

@NgModule({
	declarations: [ImageViewerComponent, dateTimePipe],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbDialogModule,
		NbButtonModule,
		NbSpinnerModule,
		NbEvaIconsModule
	],
	exports: [ImageViewerComponent],
	providers: [
		NbDialogService,
		ImageViewerService,
		ImageCacheService,
		StorageService,
		Store
	],
})
export class ImageViewerModule {}
