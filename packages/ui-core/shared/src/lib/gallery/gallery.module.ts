import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { NbButtonModule, NbDialogModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { GalleryComponent } from './gallery.component';
import { GalleryDirective } from './gallery.directive';
import { SharedModule } from '../shared.module';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbDialogModule,
		NbIconModule,
		NbTooltipModule,
		SharedModule,
		I18nTranslateModule.forChild()
	],
	exports: [GalleryDirective, GalleryComponent],
	declarations: [GalleryDirective, GalleryComponent]
})
export class GalleryModule {}
