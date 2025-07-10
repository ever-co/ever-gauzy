import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { FavoriteToggleComponent } from './favorite-toggle.component';

@NgModule({
	declarations: [FavoriteToggleComponent],
	imports: [
		CommonModule,
		NbButtonModule,
		NbIconModule,
		NbTooltipModule,
		TranslateModule
	],
	exports: [FavoriteToggleComponent]
})
export class FavoriteToggleModule {}
