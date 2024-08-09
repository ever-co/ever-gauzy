import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbDialogService,
	NbIconModule,
	NbLayoutModule,
	NbSpinnerModule
} from '@nebular/theme';
import { ImageCacheService, StorageService, Store } from '../services';
import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { ImageViewerComponent } from './image-viewer.component';
import { ImageViewerService } from './image-viewer.service';

@NgModule({
	declarations: [ImageViewerComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		NbDialogModule,
		NbButtonModule,
		NbSpinnerModule,
		NbEvaIconsModule,
		PipeModule
	],
	exports: [ImageViewerComponent],
	providers: [NbDialogService, ImageViewerService, ImageCacheService, StorageService, Store]
})
export class ImageViewerModule {}
