import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { WidgetComponent } from './widget.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	declarations: [WidgetComponent],
	imports: [CommonModule, NbIconModule, NbPopoverModule, NbButtonModule, SharedModule, TranslateModule],
	exports: [WidgetComponent]
})
export class WidgetModule {}
