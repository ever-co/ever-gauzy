import { InternalServerErrorException } from "@nestjs/common";
import * as nodemailer from 'nodemailer';
import { environment } from "@gauzy/config";
import { ISMTPConfig } from "@gauzy/common";
import { IVerifySMTPTransport } from "@gauzy/contracts";

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
            const transporter = nodemailer.createTransport({
                host: config.host,
                port: config.port || 587,
                secure: config.secure || false, // use TLS
                auth: {
                    user: config.username,
                    pass: config.password
                },
                from: config.fromAddress
            });
            // Verify the transporter
            return await transporter.verify() // Configuration is valid / invalid;
        } catch (error) {
            console.log('Error while verifying nodemailer transport: %s', error);
            throw new InternalServerErrorException(error);
        }
    }
}
