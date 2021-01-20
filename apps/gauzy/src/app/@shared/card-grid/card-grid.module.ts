import { NgModule } from '@angular/core';
import { NbCardModule } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { ThemeModule } from '../../@theme/theme.module';
import { CardGridComponent } from './card-grid.component';
import { CustomViewComponent } from './card-grid-custom.component';
import { TranslaterModule } from '../translater/translater.module';

@NgModule({
	imports: [ThemeModule, NbCardModule, TranslaterModule],
	declarations: [CardGridComponent, CustomViewComponent],
	exports: [CardGridComponent],
	entryComponents: [],
	providers: [Store]
})
export class CardGridModule {}
