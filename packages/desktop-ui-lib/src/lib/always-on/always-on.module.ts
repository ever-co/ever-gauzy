import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule, NbLayoutModule, NbTooltipModule } from '@nebular/theme';
import { LanguageModule } from '../language/language.module';
import { AlwaysOnComponent } from './always-on.component';
import { AlwaysOnService } from './always-on.service';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NbTablerIconsModule } from '@gauzy/ui-core/theme';

@NgModule({
	declarations: [AlwaysOnComponent],
	imports: [
		CommonModule,
		NbLayoutModule,
		LanguageModule.forChild(),
		NbIconModule,
		NbTablerIconsModule,
		NbTooltipModule,
		NbButtonModule,
		NbCardModule,
		FormsModule,
		FontAwesomeModule
	],
	providers: [AlwaysOnService]
})
export class AlwaysOnModule {}
