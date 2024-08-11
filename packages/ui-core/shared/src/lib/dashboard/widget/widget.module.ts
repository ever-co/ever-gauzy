import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { WidgetComponent } from './widget.component';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, NbPopoverModule, TranslateModule.forChild(), SharedModule],
	declarations: [WidgetComponent],
	exports: [WidgetComponent]
})
export class WidgetModule {}
