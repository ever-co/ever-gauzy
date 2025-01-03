import { Component } from '@angular/core';
import { NbRequestPasswordComponent } from '@nebular/auth';

@Component({
    selector: 'ngx-forgot-password',
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.scss'],
    standalone: false
})
export class NgxForgotPasswordComponent extends NbRequestPasswordComponent {}
