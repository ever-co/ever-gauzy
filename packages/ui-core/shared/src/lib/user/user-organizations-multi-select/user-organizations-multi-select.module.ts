import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbSelectModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { UserOrganizationsSelectComponent } from './user-organizations-multi-select.component';

@NgModule({
	imports: [CommonModule, NbSelectModule, I18nTranslateModule.forChild()],
	declarations: [UserOrganizationsSelectComponent],
	exports: [UserOrganizationsSelectComponent]
})
export class UserOrganizationsMultiSelectModule {}
