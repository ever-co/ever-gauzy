import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { ImageAssetComponent } from './image-asset.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		I18nTranslateModule.forChild(),
		FormsModule,
		ReactiveFormsModule
	],
	declarations: [ImageAssetComponent],
	exports: [ImageAssetComponent]
})
export class ImageAssetModule {}
