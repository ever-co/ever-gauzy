import { NgModule } from '@angular/core';
import { ThemeModule, HttpLoaderFactory } from '../../../@theme/theme.module';
import { NbCardModule, NbIconModule, NbButtonModule } from '@nebular/theme';
import { AddIconComponent } from './add-icon.component';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';

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
	entryComponents: [AddIconComponent],
	declarations: [AddIconComponent],
	exports: [AddIconComponent]
})
export class AddIconModule {}
