import { ChangeDetectorRef, Component, Inject, OnInit } from "@angular/core";
import { NB_AUTH_OPTIONS, NbAuthService, NbRequestPasswordComponent } from "@nebular/auth";
import { Router } from "@angular/router";
import { ThemeSwitchService } from "../../@core";


@Component({
    selector: 'ngx-forgot-password',
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.scss'],
})
export class NgxForgotPasswordComponent extends NbRequestPasswordComponent implements OnInit {
  lightMode: number

  constructor (
    public readonly nbAuthService: NbAuthService,
    public readonly cd: ChangeDetectorRef,
    public readonly router: Router,
    private themeSwitchService: ThemeSwitchService,
    @Inject(NB_AUTH_OPTIONS) options,
  ) {
    super(nbAuthService, options, cd, router);
  }

  ngOnInit() {
    this.themeSwitchService.lightMode$.subscribe(x => this.lightMode = x)
  }
}
