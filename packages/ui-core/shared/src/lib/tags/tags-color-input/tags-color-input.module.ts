import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagsColorInputComponent } from './tags-color-input.component';
import { NbBadgeModule, NbSelectModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TagsService } from '@gauzy/ui-core/core';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
	imports: [CommonModule, NbSelectModule, NbBadgeModule, FormsModule, NgSelectModule, TranslateModule.forChild()],
	exports: [TagsColorInputComponent],
	declarations: [TagsColorInputComponent],
	providers: [TagsService]
})
export class TagsColorInputModule {}
