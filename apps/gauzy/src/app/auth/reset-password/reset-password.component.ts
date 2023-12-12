import { NbResetPasswordComponent } from "@nebular/auth";
import { Component } from "@angular/core";

@Component({
	selector: 'ngx-reset-password',
	templateUrl: './reset-password.component.html',
	styleUrls: ['./reset-password.component.scss']
})
export class NgxResetPasswordComponent extends NbResetPasswordComponent {
	showPassword: boolean = false;
	showConfirmPassword: boolean = false;
}
