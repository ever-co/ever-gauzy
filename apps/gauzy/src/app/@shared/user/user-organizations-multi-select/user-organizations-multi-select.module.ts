import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslaterModule } from '../../translater/translater.module';
import { UserOrganizationsSelectComponent } from './user-organizations-multi-select.component';

@NgModule({
	imports: [ThemeModule, NbSelectModule, TranslaterModule],
	declarations: [UserOrganizationsSelectComponent],
	entryComponents: [UserOrganizationsSelectComponent],
	exports: [UserOrganizationsSelectComponent],
	providers: []
})
export class UserOrganizationsMultiSelectModule {}
