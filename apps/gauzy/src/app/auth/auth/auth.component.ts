import { NbAuthComponent, NbAuthService } from "@nebular/auth"
import { Component, OnInit } from "@angular/core"
import { Location } from '@angular/common'
import { Router } from "@angular/router"


@Component({
  selector: 'ngx-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class NgxAuthComponent extends NbAuthComponent implements OnInit {
  isRegister: boolean = false

  constructor (
    protected auth: NbAuthService,
    protected location: Location,
    private router: Router,
  ) {
    super(auth, location)
  }

  ngOnInit () {
    this.isRegister = this.router.url === '/auth/register'
  }
}
