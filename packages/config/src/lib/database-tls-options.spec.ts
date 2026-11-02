import { decodeCaCertificate, getTlsOptions } from './database-helpers';

/**
 * `DB_CA_CERT` takes the database CA certificate either base64-encoded (the documented form, unchanged) or as PEM
 * text (what DigitalOcean App Platform's `${db.CA_CERT}` binding and other managed databases hand out).
 */
describe('database TLS options', () => {
	// Not a real certificate: only the PEM framing matters to these tests.
	const PEM = ['-----BEGIN CERTIFICATE-----', 'MIIBszCCAVmgAwIBAgIUTESTONLY', '-----END CERTIFICATE-----', ''].join(
		'\n'
	);
	const BASE64 = Buffer.from(PEM, 'ascii').toString('base64');

	describe('decodeCaCertificate', () => {
		it('decodes a base64-encoded certificate, as before', () => {
			expect(decodeCaCertificate(BASE64)).toBe(PEM);
		});

		it('takes a PEM certificate as it is', () => {
			expect(decodeCaCertificate(PEM)).toBe(PEM);
		});

		it('takes a PEM bundle with several certificates as it is', () => {
			const bundle = `${PEM}${PEM}`;
			expect(decodeCaCertificate(bundle)).toBe(bundle);
		});

		it('takes PEM text with Windows line endings or surrounding text as it is', () => {
			const crlf = `subject=CN=db\r\n${PEM.replace(/\n/g, '\r\n')}`;
			expect(decodeCaCertificate(crlf)).toBe(crlf);
		});

		it('CONTROL: base64-decoding the PEM text (the old behaviour) yields no certificate', () => {
			expect(Buffer.from(PEM, 'base64').toString('ascii')).not.toContain('-----BEGIN CERTIFICATE-----');
		});
	});

	describe('getTlsOptions', () => {
		const original = process.env.DB_CA_CERT;
		let consoleError: jest.SpyInstance;

		beforeEach(() => {
			consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		});

		afterEach(() => {
			consoleError.mockRestore();
			if (original === undefined) {
				delete process.env.DB_CA_CERT;
			} else {
				process.env.DB_CA_CERT = original;
			}
		});

		it('returns no TLS options while DB_SSL_MODE is off', () => {
			process.env.DB_CA_CERT = BASE64;
			expect(getTlsOptions(false)).toBeUndefined();
		});

		it('returns no TLS options when DB_CA_CERT is unset', () => {
			delete process.env.DB_CA_CERT;
			expect(getTlsOptions(true)).toBeUndefined();
			expect(consoleError).toHaveBeenCalledWith('DB_CA_CERT is not defined. TLS options cannot be configured.');
		});

		it.each([
			['base64-encoded', BASE64],
			['PEM', PEM]
		])('verifies the server against a %s DB_CA_CERT', (_form, value) => {
			process.env.DB_CA_CERT = value;
			expect(getTlsOptions(true)).toEqual({ rejectUnauthorized: true, ca: PEM });
		});
	});
});
