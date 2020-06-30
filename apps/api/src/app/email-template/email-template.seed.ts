import * as fs from 'fs';
import { Connection } from 'typeorm';
import { EmailTemplate } from './email-template.entity';
import * as mjml2html from 'mjml';
import * as path from 'path';
/**
 * Note: This seed file assumes the following directory structure in seeds/data/email/default-email-templates/ folder
 *
 * [template-name] / [language-code] / [template-type].mjml
 *
 * template-name: Is the name of the template
 * language-code: Is the ISO language code lik bg, en, he, ru
 * template-type: Can be 'html', 'subject' or 'text' but needs to only have .hbs or .mjml extension
 */
export const createDefaultEmailTemplates = async (
	connection: Connection
): Promise<any> => {
	try {
		const templatePath = [
			'apps',
			'api',
			'src',
			'app',
			'core',
			'seeds',
			'data',
			'default-email-templates'
		];
		const files = [];
		let FOLDER_PATH = path.resolve('.', ...templatePath);

		FOLDER_PATH = fs.existsSync(FOLDER_PATH)
			? FOLDER_PATH
			: path.resolve('.', ...templatePath.slice(2));

		findInDir(FOLDER_PATH, files);
		console.log(files);
		await fileToTemplate(connection, files);
	} catch (error) {
		// it's not a big issue for now if we can't create email templates
		console.error(error);
	}
};

function findInDir(dir, fileList = []) {
	const files = fs.readdirSync(dir);

	files.forEach((file) => {
		const filePath = path.join(dir, file);
		const fileStat = fs.lstatSync(filePath);

		if (fileStat.isDirectory()) {
			findInDir(filePath, fileList);
		} else {
			fileList.push(filePath);
		}
	});
}

const fileToTemplate = async (connection, files) => {
	for (const file of files) {
		const template = await pathToEmailTemplate(file);
		if (template && template.hbs) {
			await insertTemplate(connection, template);
		}
	}
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
	fullPath: string
): Promise<EmailTemplate> => {
	try {
		const template = new EmailTemplate();
		const templatePath = fullPath.replace(/\\/g, '/').split('/');
		const fileName = templatePath[templatePath.length - 1].split('.', 2);
		const fileExtension = fileName[1];
		const fileNameWithoutExtension = fileName[0];
		template.languageCode = templatePath[templatePath.length - 2];
		template.name = `${
			templatePath[templatePath.length - 3]
		}/${fileNameWithoutExtension}`;
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
