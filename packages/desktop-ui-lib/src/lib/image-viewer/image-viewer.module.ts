import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
	NbButtonModule,
	NbCardModule,
	NbDialogModule,
	NbDialogService,
	NbIconModule,
	NbLayoutModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TablerIconsModule } from '@gauzy/ui-core/theme';
import { ImageCacheService, StorageService, Store } from '../services';
import { PipeModule } from '../time-tracker/pipes/pipe.module';
import { ImageViewerComponent } from './image-viewer.component';
import { ImageViewerService } from './image-viewer.service';

@NgModule({
	imports: [
		CommonModule,
		NbLayoutModule,
		NbCardModule,
		NbIconModule,
		TablerIconsModule,
		NbDialogModule,
		NbButtonModule,
		NbSpinnerModule,
		PipeModule,
		ImageViewerComponent
	],
	exports: [ImageViewerComponent],
	providers: [NbDialogService, ImageViewerService, ImageCacheService, StorageService, Store]
})
export class ImageViewerModule {}
