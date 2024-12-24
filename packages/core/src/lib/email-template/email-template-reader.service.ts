import { Injectable, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import { EmailTemplateUtils } from './utils';

@Injectable()
export class EmailTemplateReaderService implements OnModuleInit {

    /*
    * Getter & Setter for dynamic folder path
    */
    private _folderPath: string;
    get folderPath(): string {
        return this._folderPath;
    }
    set folderPath(value: string) {
        this._folderPath = value;
    }

    constructor() { }

    onModuleInit(): void {
        this.folderPath = path.join(path.join(__dirname), '../', ...EmailTemplateUtils.globalPath)
    }

    /**
     * Read email template from core folder using name
     *
     * @param name
     */
    public readEmailTemplate(folder: string): Array<Object> {
        const files = [];
        if (EmailTemplateUtils.fileExists(this.folderPath)) {
            const folderPath = path.join(this.folderPath, folder);

            // Read directory for missing templates
            EmailTemplateUtils.readdirSync(folderPath, files);
        }
        // Convert files to email templates
        return EmailTemplateUtils.filesToTemplates(files);
    }
}
