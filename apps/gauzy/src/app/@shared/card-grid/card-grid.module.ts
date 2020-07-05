import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { HttpLoaderFactory } from '../../@theme/theme.module';
import { ThemeModule } from '../../@theme/theme.module';
import { CardGridComponent } from './card-grid.component';
import { CustomViewComponent } from './card-grid-custom.component';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [CardGridComponent, CustomViewComponent],
	exports: [CardGridComponent],
	entryComponents: [],
	providers: [Store]
})
export class CardGridModule {}
