import { ChangeDetectorRef, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormGroupDirective } from '@angular/forms';
import { NbAuthService, NbLoginComponent, NB_AUTH_OPTIONS } from '@nebular/auth';
import { ElectronService } from 'ngx-electron';
import { RolesEnum } from '@gauzy/contracts';
import { environment } from './../../../environments/environment';
import { CookieService } from 'ngx-cookie-service';


@Component({
  selector: 'ngx-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class NgxLoginComponent extends NbLoginComponent implements OnInit {

  @ViewChild('form') private readonly form: FormGroupDirective;

  isShown: boolean = false;
  RolesEnum = RolesEnum;
  isDemo: boolean = environment.DEMO;
  showPassword: boolean = false;

  constructor (
    private readonly cookieService: CookieService,
    public readonly electronService: ElectronService,
    public readonly nbAuthService: NbAuthService,
    public readonly cdr: ChangeDetectorRef,
    public readonly router: Router,
    @Inject(NB_AUTH_OPTIONS) options,
  ) {
    super(nbAuthService, options, cdr, router);
  }

  ngOnInit () {
    this.checkRememberdMe();
    this.autoFillCredential();
  }

  /**
   * Implemented Rememberd Me Feature
   */
  checkRememberdMe () {
    if (this.cookieService.check('rememberMe')) {
      const { email, rememberMe } = this.cookieService.getAll();
      this.user.email = email;
      this.user.rememberMe = rememberMe;
    }
  }

  collapseDemo () {
    if (this.isDemo) {
      this.isShown = !this.isShown;
    }
  }

  /**
   * Autofill Super Admin Credential By Default
   */
  autoFillCredential () {
    if (this.isDemo) {
      this.user.email = environment.DEMO_SUPER_ADMIN_EMAIL;
      this.user.password = environment.DEMO_SUPER_ADMIN_PASSWORD;
    }
  }

  /**
   * Automatic Login For Demo Server
   *
   * @param role
   */
  autoLogin (role: RolesEnum) {
    if (this.isDemo) {
      switch (role) {
        case RolesEnum.SUPER_ADMIN:
          this.autoFillCredential();
          break;
        case RolesEnum.ADMIN:
          this.user.email = environment.DEMO_ADMIN_EMAIL;
          this.user.password = environment.DEMO_ADMIN_PASSWORD;
          break;
        case RolesEnum.EMPLOYEE:
          this.user.email = environment.DEMO_EMPLOYEE_EMAIL;
          this.user.password = environment.DEMO_EMPLOYEE_PASSWORD;
          break;
        default:
          break;
      }
      this.form.ngSubmit.emit();
    }
  }
}
