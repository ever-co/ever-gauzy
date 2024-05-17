import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { ImageAssetComponent } from './image-asset.component';

@NgModule({
	declarations: [ImageAssetComponent],
	exports: [ImageAssetComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		TranslateModule,
		FormsModule,
		ReactiveFormsModule
	]
})
export class ImageAssetModule {}
