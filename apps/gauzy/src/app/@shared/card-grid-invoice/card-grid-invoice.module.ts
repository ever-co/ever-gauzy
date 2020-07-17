import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';
import { HttpLoaderFactory } from '../../@theme/theme.module';
import { ThemeModule } from '../../@theme/theme.module';
import { CardGridInvoiceComponent } from './card-grid-invoice.component';
import { CustomViewInvoiceComponent } from './card-grid-custom-invoice.component';

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
	declarations: [CardGridInvoiceComponent, CustomViewInvoiceComponent],
	exports: [CardGridInvoiceComponent],
	entryComponents: [],
	providers: [Store]
})
export class CardGridInvoiceModule {}
