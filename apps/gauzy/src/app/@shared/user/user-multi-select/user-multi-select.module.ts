import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslaterModule } from '../../translater/translater.module';
import { UserSelectComponent } from './user-multi-select.component';

@NgModule({
	imports: [ThemeModule, NbSelectModule, TranslaterModule],
	declarations: [UserSelectComponent],
	entryComponents: [UserSelectComponent],
	exports: [UserSelectComponent],
	providers: []
})
export class UserMultiSelectModule {}
