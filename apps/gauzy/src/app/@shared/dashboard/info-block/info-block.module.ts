import { NgModule } from '@angular/core';
import {
	NbIconModule,
	NbTooltipModule,
	NbAccordionModule
} from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { InfoBlockComponent } from './info-block.component';

@NgModule({
	imports: [NbIconModule, NbTooltipModule, ThemeModule, NbAccordionModule],
	exports: [InfoBlockComponent],
	declarations: [InfoBlockComponent],
	entryComponents: [InfoBlockComponent],
	providers: []
})
export class InfoBlockModule {}
