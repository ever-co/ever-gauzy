import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { I18nTranslateModule } from '@gauzy/ui-sdk/i18n';
import { UsersService } from '@gauzy/ui-sdk/core';
import { UserMutationComponent } from './user-mutation.component';
import { UserFormsModule } from '../forms/user-forms.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbIconModule,
		I18nTranslateModule.forChild(),
		UserFormsModule
	],
	exports: [UserMutationComponent],
	declarations: [UserMutationComponent],
	providers: [UsersService]
})
export class UserMutationModule {}
