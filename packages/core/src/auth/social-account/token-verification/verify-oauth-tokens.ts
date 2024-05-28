import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export async function verifyGithubToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(
		httpService.get('https://api.github.com/user', {
			headers: {
				Authorization: `token ${token}`
			}
		})
	);
	return response.data;
}

export async function verifyGoogleToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(
		httpService.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${token}`)
	);
	return response.data;
}

export async function verifyTwitterToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(
		httpService.get('https://api.twitter.com/2/me', {
			headers: { Authorization: `Bearer ${token}` }
		})
	);
	return response.data;
}

export async function verifyFacebookToken(httpService: HttpService, token: string) {
	const response = await firstValueFrom(httpService.get(`https://graph.facebook.com/me?access_token=${token}`));
	return response.data;
}

// Add other provider verification signatures
