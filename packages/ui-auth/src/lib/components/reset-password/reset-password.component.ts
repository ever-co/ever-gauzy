import { NbResetPasswordComponent } from '@nebular/auth';
import { Component } from '@angular/core';

@Component({
	selector: 'ngx-reset-password',
	templateUrl: './reset-password.component.html',
	styleUrls: ['./reset-password.component.scss']
})
export class NgxResetPasswordComponent extends NbResetPasswordComponent {
	public showPassword: boolean = false;
	public showConfirmPassword: boolean = false;
}
