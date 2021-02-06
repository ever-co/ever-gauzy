import { applyMixins } from '@gauzy/common';
import {
	Auth0Controller,
	FacebookController,
	GithubController,
	GoogleController,
	LinkedinController,
	MicrosoftController,
	TwitterController
} from './controllers';
import { SocialAuthService } from './social-auth.service';
import { ISocialController } from './social-base';

export abstract class SocialAuthController<T>
	implements ISocialController<SocialAuthService> {
	constructor(public readonly service: SocialAuthService) {}
}

applyMixins(SocialAuthController, [
	Auth0Controller,
	FacebookController,
	GithubController,
	GoogleController,
	LinkedinController,
	MicrosoftController,
	TwitterController
]);
