import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageAssetComponent } from './image-asset.component';
import { NbButtonModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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
