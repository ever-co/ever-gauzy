import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationComponent } from './back-navigation.component';
import { NbIconModule } from '@nebular/theme';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpLoaderFactory } from '../../@theme/components/header/selectors/selectors.module';
import { HttpClient } from '@angular/common/http';

@NgModule({
	declarations: [BackNavigationComponent],
	exports: [BackNavigationComponent],
	imports: [
		NbIconModule,
		CommonModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	]
})
export class BackNavigationModule {}
