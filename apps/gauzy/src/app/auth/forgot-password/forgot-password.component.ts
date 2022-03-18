import { Component } from "@angular/core"


@Component({
  selector: 'ngx-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class NgxForgotPasswordComponent {
  email: any = ''

  constructor () {

  }

  handleSubmit () {
    console.log('submitted')
  }
}
