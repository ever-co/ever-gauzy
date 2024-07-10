import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIRECTIVES } from './index';

@NgModule({
	imports: [CommonModule],
	declarations: [...DIRECTIVES],
	exports: [...DIRECTIVES]
})
export class DirectivesModule {}
