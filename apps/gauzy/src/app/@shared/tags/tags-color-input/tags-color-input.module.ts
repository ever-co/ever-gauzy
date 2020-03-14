import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagsColorInputComponent } from './tags-color-input.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { NbBadgeModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';

@NgModule({
	imports: [CommonModule, NgSelectModule, NbBadgeModule, FormsModule],
	exports: [TagsColorInputComponent],
	declarations: [TagsColorInputComponent]
})
export class TagsColorInputModule {}
