import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationComponent } from './back-navigation.component';
import { NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '../translate/translate.module';

@NgModule({
	declarations: [BackNavigationComponent],
	exports: [BackNavigationComponent],
	imports: [
		NbIconModule,
		CommonModule,
		NbIconModule,
		NbButtonModule,
		TranslateModule
	]
})
export class BackNavigationModule {}
