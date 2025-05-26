import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { TranslateModule } from '@ngx-translate/core';
import { Store } from '@gauzy/ui-core/core';
import { CardGridComponent } from './card-grid/card-grid.component';
import { CardGridWithInitFunctionComponent } from './card-grid-with-init-function/card-grid-with-init-function.component';
import { CustomViewComponent } from './card-grid-custom.component';
import { NoDataMessageModule } from '../smart-data-layout/no-data-message/no-data-message.module';

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		InfiniteScrollModule,
		TranslateModule.forChild(),
		NoDataMessageModule
	],
	declarations: [CardGridComponent, CustomViewComponent, CardGridWithInitFunctionComponent],
	exports: [CardGridComponent, CardGridWithInitFunctionComponent],
	providers: [Store]
})
export class CardGridModule {}
