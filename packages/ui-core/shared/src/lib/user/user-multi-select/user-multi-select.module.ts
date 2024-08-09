import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { UserSelectComponent } from './user-multi-select.component';

@NgModule({
	imports: [CommonModule, NbSelectModule, TranslateModule.forChild()],
	declarations: [UserSelectComponent],
	exports: [UserSelectComponent]
})
export class UserMultiSelectModule {}
