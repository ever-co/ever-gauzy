import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { IsNull } from "typeorm";
import * as Email from 'email-templates';
import { ISMTPConfig, isEmpty } from "@gauzy/common";
import { IBasePerTenantAndOrganizationEntityModel, IVerifySMTPTransport } from "@gauzy/contracts";
import { CustomSmtp } from "./../core/entities/internal";
import { RequestContext } from "./../core/context";
import { CustomSmtpService } from "./../custom-smtp/custom-smtp.service";
import { SMTPUtils } from "./utils";
import { EmailTemplateRenderService } from "./email-template-render.service";

@Injectable()
export class EmailSendService {

    constructor(
        private readonly customSmtpService: CustomSmtpService,
        private readonly emailTemplateRenderService: EmailTemplateRenderService,
    ) { }

    /**
     *
     * @returns
     */
    public async getInstance(): Promise<Email<any>> {
        try {
            const smtpConfig: ISMTPConfig = SMTPUtils.defaultSMTPTransporter();
            const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

            // console.log('Default SMTP configuration: %s', transport);

            /** Verifies SMTP configuration */
            if (!!await SMTPUtils.verifyTransporter(transport)) {
                return this.getEmailConfig(smtpConfig);
            }
        } catch (error) {
            console.log('Error while retrieving default global smtp configuration: %s', error?.message);
            throw new InternalServerErrorException(error);
        }
    }

    /**
     *
     * @param param0
     */
    public async getEmailInstance({
        organizationId,
        tenantId = RequestContext.currentTenantId()
    }: IBasePerTenantAndOrganizationEntityModel) {
        let smtpTransporter: CustomSmtp;
        try {
            smtpTransporter = await this.customSmtpService.findOneByOptions({
                where: {
                    organizationId: isEmpty(organizationId) ? IsNull() : organizationId,
                    tenantId: isEmpty(tenantId) ? IsNull() : tenantId
                },
                order: {
                    createdAt: 'DESC'
                }
            });
            // console.log('Custom SMTP configuration for organization: %s', smtpTransporter);
            const smtpConfig: ISMTPConfig = smtpTransporter.getSmtpTransporter();
            const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

            /** Verifies SMTP configuration */
            if (!!await SMTPUtils.verifyTransporter(transport)) {
                return this.getEmailConfig(smtpConfig);
            } else {
                console.log('SMTP configuration is not set for this tenant / organization: [%s, %s]', organizationId, tenantId);
                throw new BadRequestException('SMTP configuration is not set for this tenant / organization');
            }
        } catch (error) {
            try {
                if (error instanceof NotFoundException) {
                    smtpTransporter = await this.customSmtpService.findOneByOptions({
                        where: {
                            organizationId: IsNull(),
                            tenantId: isEmpty(tenantId) ? IsNull() : tenantId
                        },
                        order: {
                            createdAt: 'DESC'
                        }
                    });
                    // console.log('Custom SMTP configuration for tenant: %s', smtpTransporter);

                    const smtpConfig: ISMTPConfig = smtpTransporter.getSmtpTransporter();
                    const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

                    // /** Verifies SMTP configuration */
                    if (!!await SMTPUtils.verifyTransporter(transport)) {
                        return this.getEmailConfig(smtpConfig);
                    } else {
                        console.log('SMTP configuration is not set for this tenant: %s', organizationId);
                        throw new BadRequestException('SMTP configuration is not set for this tenant');
                    }
                }
            } catch (error) {
                const smtpConfig: ISMTPConfig = SMTPUtils.defaultSMTPTransporter();
                const transport: IVerifySMTPTransport = SMTPUtils.convertSmtpToTransporter(smtpConfig);

                // console.log('Default SMTP configuration: %s', transport);

                /** Verifies SMTP configuration */
                if (!!await SMTPUtils.verifyTransporter(transport)) {
                    return this.getEmailConfig(smtpConfig);
                } else {
                    console.log('Error while retrieving tenant/organization smtp configuration: %s', error?.message);
                    throw new InternalServerErrorException('Error while retrieving tenant/organization smtp configuration');
                }
            }
        }
    }

    /**
     *
     * @param smtpConfig
     * @returns
     */
    private getEmailConfig(smtpConfig: ISMTPConfig): Email<any> {
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
            render: this.emailTemplateRenderService.render
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
}
