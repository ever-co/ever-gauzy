import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Directives} from "./index";


@NgModule({
	declarations: [...Directives],
	exports: [...Directives],
	imports: [
		CommonModule
	]
})
export class DirectivesModule {
}
