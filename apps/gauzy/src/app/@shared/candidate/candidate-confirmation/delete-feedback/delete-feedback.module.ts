import { NgModule } from '@angular/core';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import {
	ThemeModule,
	HttpLoaderFactory
} from '../../../../@theme/theme.module';
import { DeleteFeedbackComponent } from './delete-feedback.component';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbIconModule,
		NbButtonModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	entryComponents: [DeleteFeedbackComponent],
	declarations: [DeleteFeedbackComponent],
	exports: [DeleteFeedbackComponent]
})
export class DeleteFeedbackModule {}
