import { NgModule } from '@angular/core';
import { ThemeModule } from '../../@theme/theme.module';
import {
	NbCardModule,
	NbButtonModule,
	NbInputModule,
	NbSpinnerModule
} from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { SignInSuccessComponent } from './sign-in-success.component';
import { SignInSuccessRoutingModule } from './signin-success-routing.module';

@NgModule({
	imports: [
		SignInSuccessRoutingModule,
		ThemeModule,
		NbCardModule,
		FormsModule,
		NbButtonModule,
		NbInputModule,
		NbSpinnerModule
	],
	declarations: [SignInSuccessComponent]
})
export class SignInSuccessModule {}
