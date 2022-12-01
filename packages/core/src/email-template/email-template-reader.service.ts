import { Injectable, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as mjml2html from 'mjml';
import { EmailTemplate } from './email-template.entity';
import { IEmailTemplate } from '@gauzy/contracts';

@Injectable()
export class EmailTemplateReaderService implements OnModuleInit {

    private _dirname: string;
    private _folderPath: string;
    private readonly _globalPath = [
        'core',
        'seeds',
        'data',
        'default-email-templates',
    ];

    constructor() {}

    onModuleInit(): void {
        this._dirname = path.join(__dirname);
        this._folderPath = path.join(this._dirname, '../', ...this._globalPath)
	}

    /**
     * Read email template from core folder using name
     *
     * @param name
     */
    public readEmailTemplate(name: string): IEmailTemplate[] {
        const files = [];
        if (fs.existsSync(this._folderPath)) {
            const readdir = path.join(this._folderPath, name);

            // Read directory for missing templates
            this.readdirSync(readdir, files);
        }
        // Convert files to email templates
        return this.filesToTemplate(files);
    }

    /**
     * Read files directory
     *
     * @param dir
     * @param lists
     */
    private readdirSync(dir: string, lists: string[] = []) {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
            const filePath = path.join(dir, file);
            const fileStat = fs.lstatSync(filePath);

            if (fileStat.isDirectory()) {
                this.readdirSync(filePath, lists);
            } else {
                lists.push(filePath);
            }
        });
    }

    /**
     * Convert multiples files to email templates
     *
     * @param files
     * @returns
     */
    private filesToTemplate(files: string[] = []) {
        const templates: IEmailTemplate[] = [];
        for (const file of files) {
            const template = this.pathToEmailTemplate(file);
            templates.push(template);
        }
        return templates;
    }

    /**
     * Convert file path to email template
     *
     * @param path
     * @returns
     */
    private pathToEmailTemplate(path: string) {
        try {
            const template = new EmailTemplate();
            const paths = path.replace(/\\/g, '/').split('/');

            // Also very fast but it will remove the element from the array also, this may or may
            // not matter in your case.
            const files = paths.pop().split('.', 2);

            // separate filename & extension
            const filename = files[0];
            const extension = files[1];

            template.languageCode = paths.pop();
            template.name = `${paths.pop()}/${filename}`;

            const fileContent = fs.readFileSync(path, 'utf8');
            switch (extension) {
                case 'mjml':
                    template.mjml = fileContent;
                    template.hbs = mjml2html(fileContent).html;
                    break;
                case 'hbs':
                    template.hbs = fileContent;
                    break;
                default:
                    console.log(`Warning: ${path} Will be ignored. Only .hbs and .mjml files are supported!`);
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
    }
}