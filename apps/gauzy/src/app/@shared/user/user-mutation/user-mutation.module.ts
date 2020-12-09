import { HttpLoaderFactory, ThemeModule } from '../../../@theme/theme.module';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { NbCardModule, NbButtonModule, NbIconModule } from '@nebular/theme';
import { UserMutationComponent } from './user-mutation.component';
import { UserFormsModule } from '../forms/user-forms.module';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { UsersService } from '../../../@core/services';

@NgModule({
	imports: [
		ThemeModule,
		FormsModule,
		NbCardModule,
		UserFormsModule,
		NbButtonModule,
		NbIconModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: HttpLoaderFactory,
				deps: [HttpClient]
			}
		})
	],
	exports: [UserMutationComponent],
	declarations: [UserMutationComponent],
	entryComponents: [UserMutationComponent],
	providers: [UsersService]
})
export class UserMutationModule {}
