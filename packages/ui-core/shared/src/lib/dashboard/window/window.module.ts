import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule, NbPopoverModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '../../shared.module';
import { WindowComponent } from '../window/window.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, NbPopoverModule, TranslateModule.forChild(), SharedModule],
	declarations: [WindowComponent],
	exports: [WindowComponent]
})
export class WindowModule {}
