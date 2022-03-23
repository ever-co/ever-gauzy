import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { NB_AUTH_OPTIONS, NbAuthService, NbRegisterComponent } from '@nebular/auth';
import { Router } from "@angular/router";
import { ThemeSwitchService } from "../../@core";


@Component({
  selector: 'ngx-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class NgxRegisterComponent extends NbRegisterComponent implements OnInit {
  lightMode: number

  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  constructor (
    public readonly nbAuthService: NbAuthService,
    public readonly cd: ChangeDetectorRef,
    public readonly router: Router,
    private themeSwitchService: ThemeSwitchService,
    @Inject(NB_AUTH_OPTIONS) options,
  )
  {
    super(nbAuthService, options, cd, router);
  }

  ngOnInit() {
    this.themeSwitchService.lightMode$.subscribe(x => this.lightMode = x)
  }
}
