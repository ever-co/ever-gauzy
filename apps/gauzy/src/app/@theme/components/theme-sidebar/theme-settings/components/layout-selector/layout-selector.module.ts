import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbSelectModule, NbTooltipModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { LayoutSelectorComponent } from './layout-selector.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbIconModule,
		NbSelectModule,
		NbTooltipModule,
		I18nTranslateModule.forChild()
	],
	exports: [LayoutSelectorComponent],
	declarations: [LayoutSelectorComponent],
	providers: []
})
export class LayoutSelectorModule {}
