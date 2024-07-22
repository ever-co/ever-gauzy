import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
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
