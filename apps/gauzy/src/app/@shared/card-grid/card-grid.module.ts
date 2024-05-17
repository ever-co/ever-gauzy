import { NgModule } from '@angular/core';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { Store } from '../../@core/services/store.service';
import { ThemeModule } from '../../@theme/theme.module';
import { CardGridComponent } from './card-grid.component';
import { CustomViewComponent } from './card-grid-custom.component';
import { NoDataMessageModule } from '../no-data-message/no-data-message.module';

@NgModule({
	imports: [
		ThemeModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule,
		InfiniteScrollModule,
		NoDataMessageModule
	],
	declarations: [CardGridComponent, CustomViewComponent],
	exports: [CardGridComponent],
	providers: [Store]
})
export class CardGridModule {}
