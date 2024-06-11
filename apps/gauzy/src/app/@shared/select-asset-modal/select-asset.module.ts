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
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ImageAssetService } from '@gauzy/ui-sdk/core';
import { FileUploaderModule, ImageUploaderModule } from '@gauzy/ui-sdk/shared';
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
		I18nTranslateModule.forChild(),
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
