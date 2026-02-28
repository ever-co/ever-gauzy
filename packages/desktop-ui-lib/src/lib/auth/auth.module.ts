import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NbAuthModule } from '@nebular/auth';
import { socialLinks } from '../constants';
import { Store } from '../services';
import { authRoutes } from './auth.routes';
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
	imports: [CommonModule, nbAuthModule, RouterModule.forChild(authRoutes)],
	providers: [...nbAuthModule.providers, AuthStrategy, AuthService, Store]
})
export class AuthModule {}
