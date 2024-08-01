import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbButtonModule, NbIconModule, NbLayoutModule, NbTooltipModule } from '@nebular/theme';
import { LanguageModule } from '../language/language.module';
import { AlwaysOnComponent } from './always-on.component';
import { AlwaysOnService } from './always-on.service';

@NgModule({
	declarations: [AlwaysOnComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		LanguageModule.forChild(),
		NbIconModule,
		NbTooltipModule,
		NbButtonModule,
		NbEvaIconsModule
	],
	providers: [AlwaysOnService]
})
export class AlwaysOnModule {}
