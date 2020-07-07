import { NgModule } from '@angular/core';
import { ChecklistComponent } from './checklist.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/selectors.module';
import { HttpClient } from '@angular/common/http';
import { Store } from '../../@core/services/store.service';
import { ThemeModule } from '../../@theme/theme.module';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
	declarations: [ChecklistComponent],
	imports: [
		ThemeModule,
		ReactiveFormsModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [ChecklistComponent],
	providers: [Store]
})
export class ChecklistModule {}
