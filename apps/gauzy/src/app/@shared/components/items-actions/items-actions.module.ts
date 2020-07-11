import { HttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { NbButtonModule, NbIconModule } from '@nebular/theme';

import { Store } from '../../../@core/services/store.service';
import { ThemeModule } from '../../../@theme/theme.module';
import { ItemsActionsComponent } from './items-actions.component';

export function HttpLoaderFactory(http: HttpClient) {
	return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

const NbModules = [NbButtonModule, NbIconModule];

@NgModule({
	imports: [
		ThemeModule,
		[...NbModules],
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	declarations: [ItemsActionsComponent],
	exports: [ItemsActionsComponent],
	entryComponents: [],
	providers: [Store]
})
export class ItemsActionsModule {}
