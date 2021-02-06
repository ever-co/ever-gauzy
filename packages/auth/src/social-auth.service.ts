import { Injectable } from '@nestjs/common';
import { ConfigService, IEnvironment } from '@gauzy/config';
import * as bcrypt from 'bcrypt';

//ABSTRACT
export abstract class SocialAuthCoreService {
	public abstract validateOAuthLoginEmail(args: []): any;
}

@Injectable()
export class SocialAuthService extends SocialAuthCoreService {
	protected readonly configService: ConfigService;
	protected readonly saltRounds: number;
	protected readonly clientBaseUrl: string;

	constructor() {
		super();
		this.configService = new ConfigService();
		this.saltRounds = this.configService.get(
			'USER_PASSWORD_BCRYPT_SALT_ROUNDS'
		) as number;
		this.clientBaseUrl = this.configService.get(
			'clientBaseUrl'
		) as keyof IEnvironment;
	}

	public validateOAuthLoginEmail(args: []): any {}

	public async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	// Redirect frontend
	public async routeRedirect(
		success: boolean,
		auth: {
			jwt: string;
			userId: string;
		},
		res: any
	) {
		const { userId, jwt } = auth;

		if (success) {
			return res.redirect(
				`${this.clientBaseUrl}/#/sign-in/success?jwt=${jwt}&userId=${userId}`
			);
		} else {
			return res.redirect(`${this.clientBaseUrl}/#/auth/register`);
		}
	}
}
