import {
	HttpLoaderFactory,
	ThemeModule
} from '../../../../@theme/theme.module';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule } from '@nebular/theme';
import { TimezoneSelectorComponent } from './timezone-selector.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		ReactiveFormsModule,
		FormsModule,
		NbButtonModule,
		NgSelectModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [TimezoneSelectorComponent],
	declarations: [TimezoneSelectorComponent],
	entryComponents: [TimezoneSelectorComponent],
	providers: []
})
export class TimezoneSelectorModule {}
