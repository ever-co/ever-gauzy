import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { I18nTranslateModule } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/common';
import { CardGridComponent } from './card-grid.component';
import { CustomViewComponent } from './card-grid-custom.component';
import { NoDataMessageModule } from '../no-data-message/no-data-message.module';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		InfiniteScrollModule,
		I18nTranslateModule.forChild(),
		NoDataMessageModule
	],
	declarations: [CardGridComponent, CustomViewComponent],
	exports: [CardGridComponent],
	providers: [Store]
})
export class CardGridModule {}
