import { NbAuthComponent, NbAuthService } from "@nebular/auth"
import { Component, OnInit } from "@angular/core"
import { Location } from '@angular/common'
import { NavigationStart, Router } from "@angular/router"
import { filter } from "rxjs/operators"
import { map } from "rxjs"


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

  updateRegisterClas (url: string) {
    this.isRegister = url === '/auth/register'
  }

  ngOnInit () {
    this.updateRegisterClas(this.router.url)

    this.router.events.pipe(
      filter(e => e instanceof NavigationStart),
      map(e => e as NavigationStart),
    )
      .subscribe(e => {
        this.updateRegisterClas(e.url)
      })
  }
}
