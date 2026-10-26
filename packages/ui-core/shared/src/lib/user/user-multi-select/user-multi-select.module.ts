import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { UserSelectComponent } from './user-multi-select.component';

@NgModule({
	imports: [CommonModule, NbSelectModule, TranslatePipe],
	declarations: [UserSelectComponent],
	exports: [UserSelectComponent]
})
export class UserMultiSelectModule {}
