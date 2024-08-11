import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbAccordionModule, NbIconModule, NbTooltipModule } from '@nebular/theme';
import { InfoBlockComponent } from './info-block.component';

@NgModule({
	imports: [CommonModule, NbAccordionModule, NbIconModule, NbTooltipModule],
	exports: [InfoBlockComponent],
	declarations: [InfoBlockComponent],
	providers: []
})
export class InfoBlockModule {}
