import {
	ModuleWithProviders,
	NgModule,
	Optional,
	SkipSelf
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NbAuthModule } from '@nebular/auth';
import { NbSecurityModule, NbRoleProvider } from '@nebular/security';
import { Observable, of as observableOf } from 'rxjs';

import { throwIfAlreadyLoaded } from './module-import-guard';
import { AnalyticsService, LayoutService, SeoService } from './utils';
import { AuthModule } from './auth/auth.module';

const DATA_SERVICES = [];

export class NbSimpleRoleProvider extends NbRoleProvider {
	getRole(): Observable<string | string[]> {
		// here you could provide any role based on any auth flow
		return observableOf('guest');
	}
}

export const NB_CORE_PROVIDERS = [
	...DATA_SERVICES,

	NbSecurityModule.forRoot({
		accessControl: {
			guest: {
				view: '*'
			},
			user: {
				parent: 'guest',
				create: '*',
				edit: '*',
				remove: '*'
			}
		}
	}).providers,

	{
		provide: NbRoleProvider,
		useClass: NbSimpleRoleProvider
	},
	AnalyticsService,
	LayoutService,
	SeoService
];

@NgModule({
	imports: [CommonModule, AuthModule],
	exports: [NbAuthModule],
	declarations: []
})
export class CoreModule {
	constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
		throwIfAlreadyLoaded(parentModule, 'CoreModule');
	}

	static forRoot(): ModuleWithProviders<CoreModule> {
		return {
			ngModule: CoreModule,
			providers: [...NB_CORE_PROVIDERS]
		};
	}
}
