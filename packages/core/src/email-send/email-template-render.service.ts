import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import * as Handlebars from 'handlebars';
import { ICustomSmtp, IEmailTemplate, LanguagesEnum } from "@gauzy/contracts";
import { isEmpty } from "@gauzy/common";
import { CustomSmtp, EmailTemplate } from "../core/entities/internal";

@Injectable()
export class EmailTemplateRenderService {

    constructor(
        @InjectRepository(EmailTemplate)
        protected readonly emailTemplateRepository: Repository<EmailTemplate>,

        @InjectRepository(CustomSmtp)
        protected readonly customSmtpRepository: Repository<CustomSmtp>,
    ) { }

    /**
     * Renders an email template based on the provided view and locals.
     * @param view The name of the email template to render.
     * @param locals Local variables to be used in the template rendering.
     * @returns The rendered HTML content of the email template.
     */
    public render = async (view: string, locals: any) => {
        let smtpConfig: ICustomSmtp;
        try {
            smtpConfig = await this.customSmtpRepository.findOneOrFail({
                where: {
                    organizationId: isEmpty(locals.organizationId) ? IsNull() : locals.organizationId,
                    tenantId: isEmpty(locals.tenantId) ? IsNull() : locals.tenantId
                },
                order: {
                    createdAt: 'DESC'
                }
            });
        } catch (error) {
            console.log('Error while getting custom smtp: %s', error);
            smtpConfig = await this.customSmtpRepository.findOne({
                where: {
                    organizationId: IsNull(),
                    tenantId: isEmpty(locals.tenantId) ? IsNull() : locals.tenantId
                },
                order: {
                    createdAt: 'DESC'
                }
            });
        }
        console.log(smtpConfig);
        try {
            console.log('Email template locals: %s', locals);
            view = view.replace('\\', '/');

            let emailTemplate: IEmailTemplate;

            // Find email template customized for the given organization
            const query = new Object({
                name: view,
                languageCode: locals.locale || LanguagesEnum.ENGLISH
            });

            if (smtpConfig) {
                query['organizationId'] = locals.organizationId;
                query['tenantId'] = locals.tenantId;

                emailTemplate = await this.emailTemplateRepository.findOneBy(query);
            }

            // If no email template found for the organization, use the default template
            if (!emailTemplate) {
                query['organizationId'] = IsNull();
                query['tenantId'] = IsNull();

                emailTemplate = await this.emailTemplateRepository.findOneBy(query);
            }

            if (!emailTemplate) {
                return '';
            }

            const template = Handlebars.compile(emailTemplate.hbs);
            const html = template(locals);
            return html;
        } catch (error) {
            console.log('Error while rendering email template: %s', error);
            throw new InternalServerErrorException(error);
        }
    }
}
