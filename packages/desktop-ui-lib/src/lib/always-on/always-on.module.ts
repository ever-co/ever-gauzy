import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlwaysOnComponent } from './always-on.component';
import {
	NbButtonModule,
	NbIconModule,
	NbLayoutModule,
	NbTooltipModule,
} from '@nebular/theme';
import { NgxTranslateModule } from '../ngx-translate';
import { LanguageSelectorService } from '../language/language-selector.service';
import { AlwaysOnService } from './always-on.service';
import { NbEvaIconsModule } from '@nebular/eva-icons';

@NgModule({
	declarations: [AlwaysOnComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		NgxTranslateModule,
		NbIconModule,
		NbTooltipModule,
		NbButtonModule,
		NbEvaIconsModule
	],
	providers: [LanguageSelectorService, AlwaysOnService],
})
export class AlwaysOnModule { }
