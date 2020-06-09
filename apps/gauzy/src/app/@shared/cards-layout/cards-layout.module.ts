import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import { CardsLayoutComponent } from './cards-layout.component';
import { NbCardModule } from '@nebular/theme';

@NgModule({
	imports: [ThemeModule, NbCardModule],
	exports: [CardsLayoutComponent],
	declarations: [CardsLayoutComponent],
	entryComponents: [CardsLayoutComponent],
	providers: []
})
export class CardsLayoutModule {}
