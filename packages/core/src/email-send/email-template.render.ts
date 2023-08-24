import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { IsNull, Repository } from "typeorm";
import * as Handlebars from 'handlebars';
import { IEmailTemplate, LanguagesEnum } from "@gauzy/contracts";
import { EmailTemplate } from "../core/entities/internal";

@Injectable()
export class EmailTemplateRender {

    constructor(
        protected readonly repository: Repository<EmailTemplate>,
    ) { }

    /**
     * Renders an email template based on the provided view and locals.
     * @param view The name of the email template to render.
     * @param locals Local variables to be used in the template rendering.
     * @returns The rendered HTML content of the email template.
     */
    protected render = async (view: string, locals: any) => {
        try {
            console.log('Email template locals: %s', locals);
            view = view.replace('\\', '/');

            // Find email template customized for the given organization
            const query = {
                name: view,
                languageCode: locals.locale || LanguagesEnum.ENGLISH,
                organizationId: locals.organizationId,
                tenantId: locals.tenantId
            };

            let emailTemplate: IEmailTemplate = await this.repository.findOneBy(query);

            // If no email template found for the organization, use the default template
            if (!emailTemplate) {
                query.organizationId = IsNull();
                query.tenantId = IsNull();
                emailTemplate = await this.repository.findOneBy(query);
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
