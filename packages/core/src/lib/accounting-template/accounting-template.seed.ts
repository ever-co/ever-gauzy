import * as fs from 'fs';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { AccountingTemplate } from './accounting-template.entity';
import * as mjml2html from 'mjml';
/**
 * Note: This seed file assumes the following directory structure in seeds/data/accounting/default-accounting-templates/ folder
 *
 * [template-name] / [language-code] / [template-type].mjml
 *
 * template-name: Is the name of the template
 * language-code: Is the ISO language code lik bg, en, he, ru
 * template-type: Can be 'html', 'subject' or 'text' but needs to only have .hbs or .mjml extension
 */
export const createDefaultAccountingTemplates = async (
	dataSource: DataSource
): Promise<any> => {
	try {
		const templatePath = [
			'core',
			'seeds',
			'data',
			'default-accounting-templates'
		];
		const files = [];
		let FOLDER_PATH = path.join(__dirname, '../', ...templatePath);
		FOLDER_PATH = fs.existsSync(FOLDER_PATH)
			? FOLDER_PATH
			: path.resolve('.', ...templatePath.slice(2));

		findInDir(FOLDER_PATH, files);
		console.log(files);
		await fileToTemplate(dataSource, files);
	} catch (error) {
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
		const template = await pathToAccountingTemplate(file);
		if (template) {
			await insertTemplate(connection, template);
		}
	}
};

const insertTemplate = async (
	dataSource: DataSource,
	accountingTemplate: AccountingTemplate
): Promise<void> => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(AccountingTemplate)
		.values(accountingTemplate)
		.execute();
};

const pathToAccountingTemplate = async (
	fullPath: string
): Promise<AccountingTemplate> => {
	try {
		const template = new AccountingTemplate();
		//default template access for tenant organizations

		const templatePath = fullPath.replace(/\\/g, '/').split('/');
		template.languageCode = templatePath[templatePath.length - 2];
		const fileContent = fs.readFileSync(fullPath, 'utf8');
		const fileName = templatePath[templatePath.length - 1].split('.', 2);
		const fileNameWithoutExtension = fileName[0];
		template.name = `${templatePath[templatePath.length - 3]}`;
		template.mjml = fileContent;
		template.hbs = mjml2html(fileContent).html;
		template.templateType = fileNameWithoutExtension;
		return template;
	} catch (error) {
		console.log('Something went wrong', path, error);
		return;
	}
};
