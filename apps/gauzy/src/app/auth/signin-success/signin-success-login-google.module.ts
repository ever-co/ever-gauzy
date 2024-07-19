import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbButtonModule, NbInputModule, NbSpinnerModule } from '@nebular/theme';
import { ThemeModule } from '@gauzy/ui-core/theme';
import { SignInSuccessComponent } from './sign-in-success.component';
import { SignInSuccessRoutingModule } from './signin-success-routing.module';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		NbButtonModule,
		NbCardModule,
		NbInputModule,
		NbSpinnerModule,
		ThemeModule,
		SignInSuccessRoutingModule
	],
	declarations: [SignInSuccessComponent]
})
export class SignInSuccessModule {}
