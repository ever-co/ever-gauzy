import { NbAuthComponent, NbAuthService } from "@nebular/auth";
import { Component, OnInit } from "@angular/core";
import { Location } from '@angular/common';
import { NavigationStart, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { map } from "rxjs";
import { ThemeSwitchService } from "../../@core";


@Component({
  selector: 'ngx-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class NgxAuthComponent extends NbAuthComponent implements OnInit {
  isRegister: boolean = false;
  lightMode: number

  constructor (
    protected auth: NbAuthService,
    protected location: Location,
    private router: Router,
    private themeSwitchService: ThemeSwitchService,
  ) {
    super(auth, location);
  }

  updateRegisterClas (url: string) {
    this.isRegister = url === '/auth/register';
  }

  ngOnInit () {
    this.themeSwitchService.initializeThemeMode()
    this.themeSwitchService.lightMode$.subscribe(x => this.lightMode = x)
    this.updateRegisterClas(this.router.url);

    this.router.events.pipe(
      filter(e => e instanceof NavigationStart),
      map(e => e as NavigationStart),
    )
      .subscribe(e => {
        this.updateRegisterClas(e.url);
      });
  }
}
