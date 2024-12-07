import { ProviderEnum } from '@gauzy/contracts';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export async function verifyGithubToken(httpService: HttpService, token: string) {
	const [userResponse, emailsresponse] = await Promise.all([
		firstValueFrom(
			httpService.get('https://api.github.com/user', {
				headers: {
					Authorization: `token ${token}`
				}
			})
		),
		firstValueFrom(
			httpService.get('https://api.github.com/user/emails', {
				headers: {
					Authorization: `token ${token}`
				}
			})
		)
	]);
	const email = emailsresponse.data.find((email: any) => email.primary).email;
	return {
		...userResponse.data,
		email,
		provider: ProviderEnum.GITHUB
	};
}

export async function verifyGoogleToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(
		httpService.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${token}`)
	);
	return { ...response.data, provider: ProviderEnum.GOOGLE };
}

export async function verifyTwitterToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(
		httpService.get('https://api.twitter.com/2/me', {
			headers: { Authorization: `Bearer ${token}` }
		})
	);
	return { ...response.data, provider: ProviderEnum.TWITTER };
}

export async function verifyFacebookToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(httpService.get(`https://graph.facebook.com/me?access_token=${token}`));
	return { ...response.data, provider: ProviderEnum.FACEBOOK };
}

// Add other provider verification signatures
