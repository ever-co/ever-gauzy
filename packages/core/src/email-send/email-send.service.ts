import { Injectable, InternalServerErrorException } from "@nestjs/common";
import * as Email from 'email-templates';
import { ISMTPConfig } from "@gauzy/common";
import { SMTPUtils } from "./utils";
import { IVerifySMTPTransport } from "@gauzy/contracts";
import { EmailTemplateRender } from "./email-template.render";
// import { environment } from '@gauzy/config';

@Injectable()
export class EmailSendService extends EmailTemplateRender {

    public async getInstance(): Promise<Email<any>> {
        try {
            const smtpConfig: ISMTPConfig = SMTPUtils.defaultSMTPTransporter() as ISMTPConfig;
            /** */
            const transport: IVerifySMTPTransport = {
                host: smtpConfig?.host,
                port: smtpConfig?.port,
                secure: smtpConfig?.secure,
                username: smtpConfig?.auth.user,
                password: smtpConfig?.auth.pass,
                fromAddress: smtpConfig?.fromAddress
            };
            console.log('Default SMTP configuration: %s', transport);

            /** Verifies SMTP configuration */
            if (!!await SMTPUtils.verifyTransporter(transport)) {
                const config: Email.EmailConfig<any> = {
                    message: {
                        from: smtpConfig.fromAddress || 'noreply@gauzy.co'
                    },
                    // if you want to send emails in development or test environments, set options.send to true.
                    send: true,
                    transport: smtpConfig,
                    i18n: {},
                    views: {
                        options: {
                            extension: 'hbs'
                        }
                    },
                    render: this.render
                };
                /**
                 * TODO: uncomment this after we figure out issues with dev / prod in the environment.*.ts
                 */
                // if (!environment.production && !environment.demo) {
                //     config.preview = {
                //         open: {
                //             app: 'firefox',
                //             wait: false
                //         }
                //     };
                // }
                return new Email(config);
            }
        } catch (error) {
            console.log('Error while retrieving default global smtp configuration: %s', error);
            throw new InternalServerErrorException(error);
        }
    }
}
