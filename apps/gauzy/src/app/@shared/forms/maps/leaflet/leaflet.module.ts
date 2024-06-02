import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { NbCardModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { ThemeModule } from '../../../../@theme/theme.module';
import { LeafletMapComponent } from './leaflet.component';

@NgModule({
	declarations: [LeafletMapComponent],
	exports: [LeafletMapComponent],
	imports: [CommonModule, ThemeModule, NbCardModule, I18nTranslateModule.forChild(), LeafletModule]
})
export class LeafletMapModule {}
