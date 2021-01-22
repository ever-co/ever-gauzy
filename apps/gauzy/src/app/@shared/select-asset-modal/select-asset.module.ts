import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import {
	NbCardModule,
	NbIconModule,
	NbInputModule,
	NbButtonModule,
	NbToastrModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ImageAssetComponent } from './img-asset/img-asset.component';
import { ImagePreviewComponent } from './img-preview/img-preview.component';
import { SelectAssetComponent } from './select-asset.component';

@NgModule({
	declarations: [
		SelectAssetComponent,
		ImageAssetComponent,
		ImagePreviewComponent
	],
	imports: [
		CommonModule,
		NbCardModule,
		NbIconModule,
		NbInputModule,
		NbButtonModule,
		TranslateModule,
		NbToastrModule
	],
	providers: []
})
export class SelectAssetModule {}
