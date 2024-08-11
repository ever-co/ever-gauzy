import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbCardModule, NbIconModule } from '@nebular/theme';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { TranslateModule } from '@ngx-translate/core';
import { NoDataMessageComponent } from './no-data-message.component';

@NgModule({
	imports: [CommonModule, NbCardModule, NbEvaIconsModule, NbIconModule, TranslateModule.forChild()],
	declarations: [NoDataMessageComponent],
	exports: [NoDataMessageComponent]
})
export class NoDataMessageModule {}
