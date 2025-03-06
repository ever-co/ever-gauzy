import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIRECTIVES } from './index';
import { FormsModule } from '@angular/forms';

@NgModule({
	imports: [CommonModule, FormsModule],
	declarations: [...DIRECTIVES],
	exports: [...DIRECTIVES]
})
export class DirectivesModule {}
