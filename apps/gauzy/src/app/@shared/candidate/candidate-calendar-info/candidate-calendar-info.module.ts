import { NgModule } from '@angular/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { NbIconModule, NbButtonModule, NbCardModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { CandidateCalendarInfoComponent } from './candidate-calendar-info.component';
import { FullCalendarModule } from '@fullcalendar/angular';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		FullCalendarModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [CandidateCalendarInfoComponent],
	declarations: [CandidateCalendarInfoComponent],
	entryComponents: [CandidateCalendarInfoComponent]
})
export class CandidateCalendarInfoModule {}
