import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { NoDataMessageComponent } from './no-data-message.component';

@NgModule({
	declarations: [NoDataMessageComponent],
	imports: [CommonModule, NbCardModule, NbIconModule, TranslateModule],
	exports: [NoDataMessageComponent]
})
export class NoDataModuleModule {}
