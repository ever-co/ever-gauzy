import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackNavigationComponent } from './back-navigation.component';
import { NbIconModule, NbButtonModule } from '@nebular/theme';
import { TranslaterModule } from '../translater/translater.module';

@NgModule({
	declarations: [BackNavigationComponent],
	exports: [BackNavigationComponent],
	imports: [
		NbIconModule,
		CommonModule,
		NbIconModule,
		NbButtonModule,
		TranslaterModule
	]
})
export class BackNavigationModule {}
