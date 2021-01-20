import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { NbCardModule } from '@nebular/theme';
import { ThemeModule } from '../../../../@theme/theme.module';
import { TranslaterModule } from '../../../translater/translater.module';
import { LeafletMapComponent } from './leaflet.component';

@NgModule({
	declarations: [LeafletMapComponent],
	exports: [LeafletMapComponent],
	imports: [
		CommonModule,
		ThemeModule,
		NbCardModule,
		TranslaterModule,
		LeafletModule
	]
})
export class LeafletMapModule {}
