import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
	NbButtonModule,
	NbIconModule,
	NbSelectModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { LayoutSelectorComponent } from './layout-selector.component';

@NgModule({
	imports: [
		CommonModule,
        FormsModule,
		NbButtonModule,
		NbIconModule,
		NbSelectModule,
		NbTooltipModule,
		TranslateModule
	],
	exports: [
		LayoutSelectorComponent
	],
	declarations: [
		LayoutSelectorComponent
	],
	providers: []
})
export class LayoutSelectorModule {}