import { NbResetPasswordComponent } from '@nebular/auth';
import { Component } from '@angular/core';
import { patterns } from '@gauzy/constants';

@Component({
    selector: 'ngx-reset-password',
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.scss'],
    standalone: false
})
export class NgxResetPasswordComponent extends NbResetPasswordComponent {
	public showPassword: boolean = false;
	public showConfirmPassword: boolean = false;
	public strongPasswordPattern = patterns.strongPassword;
}
