import * as fs from 'fs';
import * as readdirp from 'readdirp';
import { Connection } from 'typeorm';
import { EmailTemplate } from './email-template.entity';
import * as mjml2html from 'mjml';

/**
 * Note: This seed file assumes the following directory structure in seeds/data/email/default-email-templates/ folder
 *
 * [template-name] / [language-code] / [template-type].mjml
 *
 * template-name: Is the name of the template
 * language-code: Is the ISO language code lik bg, en, he, ru
 * template-type: Can be 'html', 'subject' or 'text' but needs to only have .hbs or .mjml extension
 */
export const createEmailTemplates = async (
	connection: Connection
): Promise<any> => {
	const templates: string[] = [];

	const files = await readdirp.promise(
		'./apps/api/src/app/core/seeds/data/default-email-templates',
		{ depth: 2 }
	);
	for (const file of files) {
		const template = await pathToEmailTemplate(file.path, file.fullPath);
		if (template && template.hbs) {
			await insertTemplate(connection, template);
		}
	}

	return templates;
};

const insertTemplate = async (
	connection: Connection,
	emailTemplate: EmailTemplate
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmailTemplate)
		.values(emailTemplate)
		.execute();
};

const pathToEmailTemplate = async (
	path: string,
	fullPath: string
): Promise<EmailTemplate> => {
	try {
		const template = new EmailTemplate();
		const templatePath = path.replace(/\\/g, '/').split('/');
		if (templatePath.length !== 3) {
			return;
		}
		const fileName = templatePath[2].split('.', 2);
		const fileExtension = fileName[1];
		const fileNameWithoutExtension = fileName[0];
		template.languageCode = templatePath[1];
		template.name = `${templatePath[0]}/${fileNameWithoutExtension}`;
		const fileContent = fs.readFileSync(fullPath, 'utf8');

		switch (fileExtension) {
			case 'mjml':
				template.mjml = fileContent;
				template.hbs = mjml2html(fileContent).html;
				break;
			case 'hbs':
				template.hbs = fileContent;
				break;
			default:
				console.log(
					`Warning: ${path} Will be ignored. Only .hbs and .mjml files are supported!`
				);
				break;
		}
		if (!template.hbs) {
			return;
		}
		return template;
	} catch (error) {
		console.log('Something went wrong', path, error);
		return;
	}
};
