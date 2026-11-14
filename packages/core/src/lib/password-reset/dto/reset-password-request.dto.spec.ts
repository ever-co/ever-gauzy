import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { ResetPasswordRequestDTO } from './reset-password-request.dto';

/**
 * `POST /auth/request-password` validates its body with `whitelist: true`: only declared properties
 * reach the service. A client app's own reset page (`appResetPasswordUrl`) is one of them, so that
 * the link of the email can open that app instead of the Gauzy web app.
 */
describe('ResetPasswordRequestDTO', () => {
	const pipe = new ValidationPipe({ whitelist: true });
	const validate = (value: unknown) =>
		pipe.transform(value, { type: 'body', metatype: ResetPasswordRequestDTO as ArgumentMetadata['metatype'] });

	const EMAIL = 'owner@corp.test';
	const PAGE = 'https://app.ever.team/auth/reset-password';

	it('accepts the address alone (what the Gauzy web app sends)', async () => {
		await expect(validate({ email: EMAIL })).resolves.toEqual({ email: EMAIL });
	});

	it("keeps a client app's reset page", async () => {
		const body = { email: EMAIL, appResetPasswordUrl: PAGE };

		await expect(validate(body)).resolves.toEqual(body);
	});

	it('strips unknown properties', async () => {
		await expect(validate({ email: EMAIL, appResetPasswordUrl: PAGE, appName: 'Other' })).resolves.toEqual({
			email: EMAIL,
			appResetPasswordUrl: PAGE
		});
	});

	it.each([
		['an object', { appResetPasswordUrl: { href: PAGE } }],
		['an array', { appResetPasswordUrl: [PAGE] }],
		['a number', { appResetPasswordUrl: 1 }],
		['a page over the size limit', { appResetPasswordUrl: `${PAGE}?x=${'x'.repeat(2048)}` }]
	])('rejects %s', async (_label, extra) => {
		await expect(validate({ email: EMAIL, ...extra })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('still requires a valid address', async () => {
		await expect(validate({ email: 'not-an-address', appResetPasswordUrl: PAGE })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});
});
