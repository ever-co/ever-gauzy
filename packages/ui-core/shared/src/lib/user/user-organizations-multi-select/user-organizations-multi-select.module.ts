import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';
import { UserOrganizationsSelectComponent } from './user-organizations-multi-select.component';

@NgModule({
	imports: [CommonModule, NbSelectModule, TranslatePipe],
	declarations: [UserOrganizationsSelectComponent],
	exports: [UserOrganizationsSelectComponent]
})
export class UserOrganizationsMultiSelectModule {}
