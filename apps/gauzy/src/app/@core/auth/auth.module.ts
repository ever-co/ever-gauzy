import { NgModule } from '@angular/core';
import { NbAuthModule } from '@nebular/auth';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthGuard } from './auth.guard';
import { AuthStrategy } from './auth-strategy.service';
import { AuthService } from '../services/auth.service';
import { Store } from '../services/store.service';

const socialLinks = [
  {
    url: environment.GOOGLE_AUTH_LINK,
    icon: 'google-outline'
  },
  {
    url: environment.LINKEDIN_AUTH_LINK,
    icon: 'linkedin-outline'
  },
  {
    url: environment.COMPANY_GITHUB_LINK,
    icon: 'github-outline'
  },
  {
    url: environment.COMPANY_TWITTER_LINK,
    target: '_blank',
    icon: 'twitter-outline'
  },
  {
    url: environment.COMPANY_FACEBOOK_LINK,
    target: '_blank',
    icon: 'facebook-outline'
  }
];

@NgModule({
  imports: [CommonModule, NbAuthModule],
  providers: [
    ...NbAuthModule.forRoot({
      strategies: [AuthStrategy.setup({ name: 'email' })],
      forms: {
        login: { socialLinks },
        register: { socialLinks }
      }
    }).providers,

    AuthGuard,
    AuthStrategy,
    AuthService,
    Store
  ]
})
export class AuthModule {}
