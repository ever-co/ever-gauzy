import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { NbAuthModule } from '@nebular/auth';
import { socialLinks } from '../constants';
import { Store } from '../services';
import { AuthGuard } from './auth.guard';
import { NoAuthGuard } from './no-auth.guard';
import { AuthService, AuthStrategy } from './services';

export * from './auth.guard';
export * from './no-auth.guard';
export * from './services';

const nbAuthModule = NbAuthModule.forRoot({
	strategies: [AuthStrategy.setup({ name: 'email' })],
	forms: {
		login: { socialLinks },
		register: { socialLinks }
	}
});

@NgModule({
	imports: [CommonModule, nbAuthModule],
	providers: [...nbAuthModule.providers, AuthGuard, NoAuthGuard, AuthStrategy, AuthService, Store]
})
export class AuthModule {}
