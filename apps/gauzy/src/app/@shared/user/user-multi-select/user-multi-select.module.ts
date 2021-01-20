import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslateModule } from '../../translate/translate.module';
import { UserSelectComponent } from './user-multi-select.component';

@NgModule({
	imports: [ThemeModule, NbSelectModule, TranslateModule],
	declarations: [UserSelectComponent],
	entryComponents: [UserSelectComponent],
	exports: [UserSelectComponent],
	providers: []
})
export class UserMultiSelectModule {}
