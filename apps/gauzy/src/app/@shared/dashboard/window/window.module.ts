import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { WindowComponent } from '../window/window.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [WindowComponent],
	exports: [WindowComponent],
	imports: [CommonModule, NbIconModule, NbPopoverModule, NbButtonModule, SharedModule, TranslateModule.forChild()]
})
export class WindowModule {}
