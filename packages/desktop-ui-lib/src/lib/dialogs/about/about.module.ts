import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutComponent } from './about.component';
import { NbButtonModule, NbCardModule, NbLayoutModule } from '@nebular/theme';
import { NgxTranslateModule } from '../../ngx-translate';
import { LanguageSelectorService } from '../../language/language-selector.service';

@NgModule({
	declarations: [AboutComponent],
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbLayoutModule,
		NgxTranslateModule
	],
	providers: [LanguageSelectorService]
})
export class AboutModule { }
