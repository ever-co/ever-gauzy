import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { NgxFaqComponent } from './faq.component';

@NgModule({
	imports: [CommonModule, NbButtonModule, NbIconModule, TranslatePipe],
	declarations: [NgxFaqComponent],
	exports: [NgxFaqComponent]
})
export class NgxFaqModule {}
