import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageAssetComponent } from './image-asset.component';
import { NbButtonModule, NbCardModule, NbInputModule } from '@nebular/theme';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	declarations: [ImageAssetComponent],
	exports: [ImageAssetComponent],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		NbCardModule,
		NbButtonModule,
		NbInputModule,
		TranslateModule
	]
})
export class ImageAssetModule {}
