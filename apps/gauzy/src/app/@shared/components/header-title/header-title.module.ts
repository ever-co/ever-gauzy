import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderTitleComponent } from './header-title.component';
import { TranslateModule } from '../../translate/translate.module';
import { SharedModule } from '../../shared.module';

@NgModule({
	imports: [
		CommonModule,
		TranslateModule,
		SharedModule
	],
	declarations: [
		HeaderTitleComponent
	],
	exports: [
		HeaderTitleComponent
	]
})
export class HeaderTitleModule {}
