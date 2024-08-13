import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { SignInSuccessComponent } from './sign-in-success.component';
import { SignInSuccessRoutingModule } from './signin-success-routing.module';

@NgModule({
	imports: [CommonModule, FormsModule, NbCardModule, NbSpinnerModule, SignInSuccessRoutingModule],
	declarations: [SignInSuccessComponent]
})
export class SignInSuccessModule {}
