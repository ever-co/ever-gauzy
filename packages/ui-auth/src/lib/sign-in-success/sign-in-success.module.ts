import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NbCardModule, NbSpinnerModule } from '@nebular/theme';
import { SignInSuccessComponent } from './sign-in-success.component';

const routes = [
	{
		path: 'success',
		component: SignInSuccessComponent
	},
	{
		path: 'google',
		component: SignInSuccessComponent
	}
];

@NgModule({
	imports: [CommonModule, RouterModule.forChild(routes), NbCardModule, NbSpinnerModule],
	exports: [RouterModule],
	declarations: [SignInSuccessComponent]
})
export class SignInSuccessModule {}
