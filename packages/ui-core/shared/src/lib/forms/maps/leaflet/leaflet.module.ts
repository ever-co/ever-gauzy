import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { LeafletModule } from '@bluehalo/ngx-leaflet';
import { NbCardModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { LeafletMapComponent } from './leaflet.component';

@NgModule({
	declarations: [LeafletMapComponent],
	exports: [LeafletMapComponent],
	imports: [CommonModule, NbCardModule, TranslatePipe, LeafletModule]
})
export class LeafletMapModule {}
