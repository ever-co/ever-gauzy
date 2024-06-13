import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { SharedModule } from '../../shared.module';
import { WindowComponent } from '../window/window.component';

@NgModule({
	imports: [
		CommonModule,
		NbButtonModule,
		NbIconModule,
		NbPopoverModule,
		I18nTranslateModule.forChild(),
		SharedModule
	],
	declarations: [WindowComponent],
	exports: [WindowComponent]
})
export class WindowModule {}
