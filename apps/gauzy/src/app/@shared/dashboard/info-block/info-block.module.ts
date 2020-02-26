import { NgModule } from '@angular/core';
import { NbIconModule, NbTooltipModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { InfoBlockComponent } from './info-block.component';

@NgModule({
	imports: [NbIconModule, NbTooltipModule, ThemeModule],
	exports: [InfoBlockComponent],
	declarations: [InfoBlockComponent],
	entryComponents: [InfoBlockComponent],
	providers: []
})
export class InfoBlockModule {}
