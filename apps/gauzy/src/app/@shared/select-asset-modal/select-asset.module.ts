import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbButtonModule,
	NbToastrModule,
	NbDialogModule,
	NbSpinnerModule
} from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ImageAssetService } from '../../@core/services/image-asset.service';
import { FileUploaderModule } from '../file-uploader-input/file-uploader-input.module';
import { ImageUploaderModule } from '../image-uploader/image-uploader.module';
import { ImageAssetComponent } from './img-asset/img-asset.component';
import { ImagePreviewComponent } from './img-preview/img-preview.component';
import { SelectAssetComponent } from './select-asset.component';

@NgModule({
	declarations: [SelectAssetComponent, ImageAssetComponent, ImagePreviewComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		TranslateModule.forChild(),
		NbToastrModule,
		ImageUploaderModule,
		FileUploaderModule,
		NbToastrModule,
		NbDialogModule,
		NbSpinnerModule
	],
	providers: [ImageAssetService]
})
export class SelectAssetModule {}
