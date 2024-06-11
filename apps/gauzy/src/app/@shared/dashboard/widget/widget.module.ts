import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '@gauzy/ui-sdk/shared';
import { WidgetComponent } from './widget.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		I18nTranslateModule.forChild(),
		SharedModule
	],
	declarations: [WidgetComponent],
	exports: [WidgetComponent]
})
export class WidgetModule {}
