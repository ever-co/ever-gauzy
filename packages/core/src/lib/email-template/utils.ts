import { QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as mjml2html from 'mjml';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import * as moment from 'moment';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { DatabaseTypeEnum } from '@gauzy/config';
import { replacePlaceholders } from '../core/utils';
import { prepareSQLQuery as p } from '../database/database.helper';

/**
 * Email templates utils functions.
 */
export class EmailTemplateUtils {
	private static readonly supportedDatabaseTypes = new Set([
		DatabaseTypeEnum.sqlite,
		DatabaseTypeEnum.betterSqlite3,
		DatabaseTypeEnum.postgres,
		DatabaseTypeEnum.mysql
	]);
	public static globalPath = ['core', 'seeds', 'data', 'default-email-templates'];

	/**
	 * Migrate email templates for a specific folder
	 *
	 * @param queryRunner QueryRunner instance to run database queries.
	 * @param folder Folder enum indicating the email template category.
	 */
	public static async migrateEmailTemplates(queryRunner: QueryRunner, folder: EmailTemplateEnum): Promise<void> {
		// Return early if folder is empty
		if (isEmpty(folder)) return;

		// Define the template path
		const templatePath = path.join(__dirname, '../', ...EmailTemplateUtils.globalPath);

		// Check if the template path exists
		if (!EmailTemplateUtils.fileExists(templatePath)) return;

		// Define folder path and prepare file list
		const folderPath = path.join(templatePath, folder);
		const files = [];

		// Read directory to collect files
		EmailTemplateUtils.readdirSync(folderPath, files);

		// Proceed only if there are files to migrate
		if (files.length > 0) {
			// Convert files to template objects
			const templates = EmailTemplateUtils.filesToTemplates(files);

			// Create or update the templates in the database
			await EmailTemplateUtils.createOrUpdateTemplates(queryRunner, templates);

			// Log the migration completion
			console.log(
				chalk.magenta(`${moment().format('DD.MM.YYYY HH:mm:ss')} Migrated email templates for ${folderPath}`)
			);
		}
	}

	/**
	 * Recursively reads files from a directory and adds them to the files array.
	 *
	 * @param directory The directory to read from.
	 * @param files The array that will hold file paths.
	 */
	public static readdirSync(directory: string, files: string[] = []): void {
		// Check if the directory exists
		if (!EmailTemplateUtils.fileExists(directory)) {
			return;
		}

		const items = fs.readdirSync(directory);

		for (const item of items) {
			const filePath = path.join(directory, item);

			// Proceed only if the file path exists
			if (EmailTemplateUtils.fileExists(filePath)) {
				const fileStat = fs.lstatSync(filePath);

				// Recursively read the directory
				if (fileStat.isDirectory()) {
					EmailTemplateUtils.readdirSync(filePath, files);
				} else {
					files.push(filePath);
				}
			}
		}
	}

	/**
	 * Checks whether a file path exists.
	 *
	 * @param filePath The path to check.
	 * @returns true if the file or directory exists, false otherwise.
	 */
	public static fileExists(filePath: string): boolean {
		try {
			return fs.existsSync(filePath);
		} catch (error) {
			console.error(`Error checking file existence for path: ${filePath}`, error);
			return false;
		}
	}

	/**
	 * Converts a file path to an email template object.
	 *
	 * @param path The file path to convert.
	 * @returns The template object or undefined if the conversion fails.
	 */
	public static pathToTemplate(filePath: string): Record<string, any> | undefined {
		try {
			const template: Record<string, any> = {};
			const normalizedPath = filePath.replace(/\\/g, '/');
			const pathSegments = normalizedPath.split('/');

			// Extract filename and extension from the last segment
			const [filename, extension] = pathSegments.pop()?.split('.', 2) || [];

			if (!filename || !extension) {
				console.warn(`Invalid file structure: ${filePath}`);
				return;
			}

			// Extract language code and template name
			template['languageCode'] = pathSegments.pop();
			template['name'] = `${pathSegments.pop()}/${filename}`;

			// Read the file content
			const fileContent = fs.readFileSync(filePath, 'utf8');

			// Handle the file based on its extension
			switch (extension) {
				case 'mjml':
					template['mjml'] = fileContent;
					template['hbs'] = mjml2html(fileContent).html;
					break;
				case 'hbs':
					template['hbs'] = fileContent;
					break;
				default:
					console.warn(`Unsupported file extension: ${filePath}. Only .hbs and .mjml are supported!`);
					return;
			}

			// Ensure the template has compiled 'hbs' content
			if (!template['hbs']) {
				console.warn(`Missing 'hbs' content for template: ${filePath}`);
				return;
			}

			return template;
		} catch (error) {
			console.error(`Error converting file path to template: ${filePath}`, error);
			return;
		}
	}

	/**
	 * Convert multiple file paths to email templates.
	 *
	 * @param files Array of file paths.
	 * @returns Array of template objects.
	 */
	public static filesToTemplates(files: string[] = []): Array<Record<string, any>> {
		const templates: Array<Record<string, any>> = [];

		for (const file of files) {
			const template = EmailTemplateUtils.pathToTemplate(file);

			// Only add the template if it was successfully created
			if (template) {
				templates.push(template);
			}
		}

		return templates;
	}

	/**
	 * Create or update email templates in the database.
	 *
	 * @param queryRunner - The QueryRunner instance to execute database queries.
	 * @param templates - Array of template objects containing template details.
	 */
	public static async createOrUpdateTemplates(queryRunner: QueryRunner, templates: Array<Record<string, any>> = []) {
		// Get the database type
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;

		// Validate the database type
		EmailTemplateUtils.validateDatabaseType(queryRunner.connection.options.type as DatabaseTypeEnum);

		// Determine select query based on the database type
		const selectQuery = this.getSelectQuery(type);

		// Determine update query based on the database type
		const updateQuery = this.getUpdateQuery(type);

		// Determine insert query based on the database type
		const insertQuery = this.generateInsertQuery(type);

		// Define a set of database types that require the 'id' column in the INSERT query
		const sqlTypesWithId = new Set([
			DatabaseTypeEnum.sqlite,
			DatabaseTypeEnum.betterSqlite3,
			DatabaseTypeEnum.mysql
		]);

		// Loop through the templates
		for (const template of templates) {
			const payload = sqlTypesWithId.has(type)
				? [template.name, template.languageCode, template.hbs, template.mjml, uuidV4()]
				: [template.name, template.languageCode, template.hbs, template.mjml];

			await this.upsertEmailTemplate(
				queryRunner,
				selectQuery,
				updateQuery,
				insertQuery,
				template.name,
				template.languageCode,
				template.hbs,
				template.mjml,
				payload
			);
		}
	}

	/**
	 * Upsert an email template based on its existence in the database.
	 *
	 * @param queryRunner - The QueryRunner instance for executing queries.
	 * @param type - The type of the database (e.g., sqlite, mysql).
	 * @param selectQuery - The SQL query to check if the template exists.
	 * @param updateQuery - The SQL query to update the template.
	 * @param insertQuery - The SQL query to insert a new template.
	 * @param name - The name of the email template.
	 * @param languageCode - The language code of the email template.
	 * @param hbs - The Handlebars (hbs) content of the template.
	 * @param mjml - The MJML content of the template.
	 * @param payload - The payload for the insert query, including necessary fields.
	 */
	static async upsertEmailTemplate(
		queryRunner: QueryRunner,
		selectQuery: string,
		updateQuery: string,
		insertQuery: string,
		name: string,
		languageCode: string,
		hbs: string,
		mjml: string,
		payload: any
	): Promise<void> {
		// Get the database manager
		const manager = queryRunner.connection.manager;

		try {
			// Execute the SELECT query to check if the template exists
			const [template]: any = await manager.query(selectQuery, [name, languageCode]);

			// Safely parse the count value
			const templateCount = Number(template.count);

			if (templateCount > 0) {
				// Execute the UPDATE query if the template exists
				await manager.query(updateQuery, [hbs, mjml, name, languageCode]);
				console.log(`✅ Updated email template: ${name}`);
			} else {
				// Execute the INSERT query if the template does not exist
				await manager.query(insertQuery, payload);
				console.log(`✅ Inserted email template: ${name}`);
			}
		} catch (error) {
			console.error(`❌ Error upsert email template "${name}":`, error);
		}
	}

	/**
	 * Generates the appropriate INSERT query based on the database type.
	 * @param type - The type of the database.
	 * @returns The INSERT SQL query string.
	 */
	public static generateInsertQuery(type: DatabaseTypeEnum): string {
		// Define a set of database types that require the 'id' column in the INSERT query
		const sqlTypesWithId = new Set([
			DatabaseTypeEnum.sqlite,
			DatabaseTypeEnum.betterSqlite3,
			DatabaseTypeEnum.mysql
		]);

		const baseColumns = ['name', 'languageCode', 'hbs', 'mjml'];
		const requiresId = sqlTypesWithId.has(type);
		const columns = requiresId ? [...baseColumns, 'id'] : baseColumns;

		const placeholders = requiresId
			? columns.map(() => '?').join(', ')
			: columns.map((_, index) => `$${index + 1}`).join(', ');

		const columnsString = columns.map((col) => `"${col}"`).join(', ');

		const query = `INSERT INTO "email_template" (${columnsString}) VALUES(${placeholders})`;

		return replacePlaceholders(p(query), type);
	}

	/**
	 * Generates the appropriate SELECT query based on the database type.
	 *
	 * @param type - The type of the database.
	 * @returns The SELECT SQL query string.
	 */
	private static getSelectQuery(type: DatabaseTypeEnum): string {
		// Prepare the select query
		const query = `SELECT COUNT(*) as count FROM "email_template" WHERE "name" = $1 AND "languageCode" = $2 AND "tenantId" IS NULL AND "organizationId" IS NULL`;

		// Replace $ placeholders with ? for mysql, sqlite & better-sqlite3
		return replacePlaceholders(p(query), type);
	}

	/**
	 * Generates the appropriate UPDATE query based on the database type.
	 *
	 * @param type - The type of the database.
	 * @returns The UPDATE SQL query string.
	 */
	private static getUpdateQuery(type: DatabaseTypeEnum): string {
		// Prepare the select query
		const query = `UPDATE "email_template" SET "hbs" = $1, "mjml" = $2 WHERE "name" = $3 AND "languageCode" = $4 AND "tenantId" IS NULL AND "organizationId" IS NULL`;

		// Replace $ placeholders with ? for mysql, sqlite & better-sqlite3
		return replacePlaceholders(p(query), type);
	}

	/**
	 * Validates the database type.
	 *
	 * @param type
	 */
	private static validateDatabaseType(type: DatabaseTypeEnum): void {
		if (!EmailTemplateUtils.supportedDatabaseTypes.has(type)) {
			throw new Error(`Unsupported database: ${type}`);
		}
	}
}
