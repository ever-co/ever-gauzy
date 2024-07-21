import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { LeafletMapComponent } from './leaflet.component';

@NgModule({
	declarations: [LeafletMapComponent],
	exports: [LeafletMapComponent],
	imports: [CommonModule, NbCardModule, I18nTranslateModule.forChild(), LeafletModule]
})
export class LeafletMapModule {}
