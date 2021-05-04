import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderTitleComponent } from './header-title.component';
import { TranslateModule } from '../../translate/translate.module';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule
	],
	declarations: [
		HeaderTitleComponent
	],
	exports: [
		HeaderTitleComponent
	]
})
export class HeaderTitleModule {}
