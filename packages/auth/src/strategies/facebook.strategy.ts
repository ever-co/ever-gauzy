import { ConfigService } from '@gauzy/config';
import { Injectable } from '@nestjs/common';
import { IFacebookConfig } from '@gauzy/common';
import * as FacebookTokenStrategy from 'passport-facebook-token';
import { use } from 'passport';

@Injectable()
export class FacebookStrategy {
	constructor(private readonly configService: ConfigService) {
		this.init();
	}

	private init(): void {
		const {
			clientId,
			clientSecret,
			fbGraphVersion
		} = this.configService.get('facebookConfig') as IFacebookConfig;

		use(
			'facebook',
			new FacebookTokenStrategy(
				{
					clientID: clientId || 'disabled',
					clientSecret: clientSecret || 'disabled',
					profileFields: ['emails', 'name'],
					fbGraphVersion: fbGraphVersion
				},
				async (
					accessToken: string,
					refreshToken: string,
					profile: any,
					done: Function
				) => {
					try {
						const { name, emails } = profile;
						console.log(profile, 'profile');
						console.log(accessToken, 'accessToken');
						console.log(refreshToken, 'refreshToken');

						const user = {
							emails,
							accessToken
						};
						done(null, user);
					} catch (err) {
						done(err, false);
					}
				}
			)
		);
	}
}
