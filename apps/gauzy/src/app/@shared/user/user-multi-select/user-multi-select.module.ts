import { NgModule } from '@angular/core';
import { NbSelectModule } from '@nebular/theme';
import { ThemeModule } from '../../../@theme/theme.module';
import { TranslateModule } from '@gauzy/ui-sdk/i18n';
import { UserSelectComponent } from './user-multi-select.component';

@NgModule({
	imports: [ThemeModule, NbSelectModule, TranslateModule],
	declarations: [UserSelectComponent],
	exports: [UserSelectComponent],
	providers: []
})
export class UserMultiSelectModule {}
