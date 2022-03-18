import { CommonModule } from '@angular/common'
import { NgModule } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterModule } from '@angular/router'

import { NgxAuthRoutingModule } from './auth-routing.module'
import { NbAuthModule } from '@nebular/auth'
import {
  NbAlertModule,
  NbButtonModule,
  NbCardModule,
  NbCheckboxModule,
  NbIconModule,
  NbInputModule,
  NbAccordionModule,
  NbFormFieldModule, NbSelectModule, NbLayoutModule,
} from '@nebular/theme'
import { NgxRegisterComponent } from './register/register.component'
import { NgxLoginComponent } from './login/login.component'
import { TranslateModule } from '../@shared/translate/translate.module'
import { NgxWhatsNewComponent } from "./login/whats-new/whats-new.component"
import { NgxDemoAccountsAsideComponent } from "./login/demo-accounts-aside/demo-accounts-aside.component"
import { NgxForgotPasswordComponent } from "./login/forgot-password/forgot-password.component"
import { NgxRegisterSideFeaturesComponent } from "./register/register-side-features/register-side-features.component"
import {
  NgxRegisterSideSingleFeatureComponent
} from "./register/register-side-features/register-side-single-feature/register-side-single-feature.component"
import { NgxAuthComponent } from "./auth/auth.component"
import { NgxThemeSwitchComponent } from "./theme-switch/theme-switch.component"


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NbAlertModule,
    NbInputModule,
    NbButtonModule,
    NbCheckboxModule,
    NgxAuthRoutingModule,
    NbAuthModule,
    NbIconModule,
    NbCardModule,
    TranslateModule,
    NbAccordionModule,
    NbFormFieldModule,
    NbSelectModule,
    NbLayoutModule,
  ],
  declarations: [
    NgxRegisterComponent,
    NgxLoginComponent,
    NgxWhatsNewComponent,
    NgxDemoAccountsAsideComponent,
    NgxForgotPasswordComponent,
    NgxRegisterSideFeaturesComponent,
    NgxRegisterSideSingleFeatureComponent,
    NgxAuthComponent,
    NgxRegisterComponent,
    NgxThemeSwitchComponent,
  ],
})
export class NgxAuthModule {}
