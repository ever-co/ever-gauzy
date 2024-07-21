import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { TranslateModule as I18nTranslateModule } from '@ngx-translate/core';
import { UsersService } from '@gauzy/ui-core/core';
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
