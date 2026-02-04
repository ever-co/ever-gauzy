import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbButtonModule, NbCardModule, NbIconModule } from '@nebular/theme';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { TranslateModule } from '@ngx-translate/core';
import { Store } from '@gauzy/ui-core/core';
import { CardGridComponent } from './card-grid.component';
import { CustomViewComponent } from './card-grid-custom.component';
import { NoDataMessageModule } from '../smart-data-layout/no-data-message/no-data-message.module';

// Standalone Modules
const STANDALONE_MODULES = [
	InfiniteScrollDirective // Standalone directive must be imported, not declared
];

@NgModule({
	imports: [
		CommonModule,
		NbCardModule,
		NbButtonModule,
		NbIconModule,
		...STANDALONE_MODULES,
		TranslateModule.forChild(),
		NoDataMessageModule
	],
	declarations: [CardGridComponent, CustomViewComponent],
	exports: [CardGridComponent],
	providers: [Store]
})
export class CardGridModule {}
