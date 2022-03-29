import {  Component } from '@angular/core';
import { NbRegisterComponent } from '@nebular/auth';



@Component({
  selector: 'ngx-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class NgxRegisterComponent extends NbRegisterComponent {

  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
}
