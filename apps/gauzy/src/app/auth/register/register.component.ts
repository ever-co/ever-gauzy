import {  Component } from '@angular/core';
import { NbRegisterComponent } from '@nebular/auth';
import { patterns } from '../../@shared/regex/regex-patterns.const';

@Component({
	selector: 'ngx-register',
	templateUrl: './register.component.html',
	styleUrls: ['./register.component.scss'],
})
export class NgxRegisterComponent extends NbRegisterComponent {
	showPassword: boolean = false;
	showConfirmPassword: boolean = false;
	passwordNoSpaceEdges = patterns.passwordNoSpaceEdges;
}
