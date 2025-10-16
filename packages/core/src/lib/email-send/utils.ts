import * as nodemailer from 'nodemailer';
import { ISMTPConfig } from '@gauzy/common';
import { environment } from '@gauzy/config';
import { IVerifySMTPTransport } from '@gauzy/contracts';

/**
 * Email utils functions.
 */
export class SMTPUtils {
	/**
	 * Returns the default SMTP transporter configuration based on the environment.
	 * @param auth Whether to include the authentication details in the configuration.
	 * @returns An SMTP configuration object.
	 */
	public static defaultSMTPTransporter(auth: boolean = true): ISMTPConfig {
		const smtpConfig: ISMTPConfig = environment.smtpConfig; // Assuming environment.smtpConfig holds your SMTP configuration

		const smtp: Partial<ISMTPConfig> = {
			fromAddress: smtpConfig.fromAddress,
			host: smtpConfig.host,
			port: smtpConfig.port,
			secure: smtpConfig.secure
		};

		if (auth) {
			smtp.auth = {
				user: smtpConfig.auth.user,
				pass: smtpConfig.auth.pass
			};
		}

		// Construct and return the SMTP configuration object
		return smtp as ISMTPConfig;
	}
	/**
	 * Verifies the configuration of an SMTP transporter.
	 * @param config The configuration object for the SMTP transporter.
	 * @returns A Promise that resolves to true if the configuration is valid, or false if there's an error.
	 */
	public static async verifyTransporter(config: IVerifySMTPTransport): Promise<boolean> {
		try {
			const port = config.port || 587;
			// For SMTP: port 465 requires secure: true (implicit TLS). Port 587 should be secure: false with STARTTLS.
			const secure = port === 465 ? true : false;
			const transporter = nodemailer.createTransport({
				from: config.fromAddress,
				host: config.host,
				port,
				secure,
				requireTLS: port === 587 ? true : undefined,
				tls: port === 587 ? { servername: config.host } : undefined,
				auth: {
					user: config.username,
					pass: config.password
				}
			});
			// Verify the transporter
			return await transporter.verify(); // Configuration is valid / invalid;
		} catch (error) {
			console.log('Error while verifying nodemailer transport: %s', error?.message);
			return false;
		}
	}

	/**
	 *
	 * @param config
	 */
	public static convertSmtpToTransporter(config: ISMTPConfig): IVerifySMTPTransport {
		/** */
		const normalizedPort = config?.port ?? 587;
		// Normalize secure flag: enforce true for 465, false for others (e.g., 587 STARTTLS)
		const normalizedSecure = normalizedPort === 465 ? true : false;
		const transport: IVerifySMTPTransport = {
			host: config?.host,
			port: normalizedPort,
			secure: normalizedSecure,
			username: config?.auth.user,
			password: config?.auth.pass,
			fromAddress: config?.fromAddress
		};
		// console.log('SMTP config to transporter configuration: %s', transport);
		return transport;
	}
}
