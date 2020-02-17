import * as fs from 'fs';
import * as readdirp from 'readdirp';
import { Connection } from 'typeorm';
import { EmailTemplate } from './email-template.entity';
/**
 * Note: This seed file assumes the following directory structure in seeds/default-email-templates/ folder
 *
 * [template-name] / [language-code] / [template-type].hbr
 *
 * template-name: Is the name of the template
 * language-code: Is the ISO language code lik bg, en, he, ru
 * template-type: Can be 'html', 'subject' or 'text'
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
		await insertTemplate(connection, template);
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
	const template = new EmailTemplate();
	const templatePath = path.split('/');
	if (templatePath.length !== 3) {
		return;
	}
	const fieNameWithoutExtension = templatePath[2].split('.', 2)[0];
	template.languageCode = templatePath[1];
	template.name = `${templatePath[0]}/${fieNameWithoutExtension}`;
	template.template = fs.readFileSync(fullPath, 'utf8');
	return template;
};
