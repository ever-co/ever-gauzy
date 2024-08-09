import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NbButtonModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { ImageAssetComponent } from './image-asset.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		TranslateModule.forChild(),
		FormsModule,
		ReactiveFormsModule
	],
	declarations: [ImageAssetComponent],
	exports: [ImageAssetComponent]
})
export class ImageAssetModule {}
