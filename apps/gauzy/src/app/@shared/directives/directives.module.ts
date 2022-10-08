import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DIRECTIVES} from "./index";


@NgModule({
	declarations: [...DIRECTIVES],
	exports: [...DIRECTIVES],
	imports: [
		CommonModule
	]
})
export class DirectivesModule {
}
