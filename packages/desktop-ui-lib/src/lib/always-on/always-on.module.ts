import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbEvaIconsModule } from '@nebular/eva-icons';
import { NbButtonModule, NbCardModule, NbIconModule, NbLayoutModule, NbTooltipModule } from '@nebular/theme';
import { LanguageModule } from '../language/language.module';
import { AlwaysOnComponent } from './always-on.component';
import { AlwaysOnService } from './always-on.service';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@NgModule({
	declarations: [AlwaysOnComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		LanguageModule.forChild(),
		NbIconModule,
		NbTooltipModule,
		NbButtonModule,
		NbEvaIconsModule,
		NbCardModule,
		FormsModule,
		FontAwesomeModule
	],
	providers: [AlwaysOnService]
})
export class AlwaysOnModule { }
