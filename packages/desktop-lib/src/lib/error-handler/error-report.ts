import { app, shell } from 'electron';
import { IErrorReport } from './i-error-report';
import * as os from 'os';
import { IErrorReportRepository } from './i-error-report-repository';

export class ErrorReport implements IErrorReport {
	private _title: string;
	private _description: string;
	private _repository: IErrorReportRepository;

	constructor(
		repository?: IErrorReportRepository,
		title?: string,
		description?: string
	) {
		this.title =
			title ||
		`Automatic error report for ${this.appName
			} App ${app.getVersion()}`;
		this.description = description;
		this.repository = repository;
	}
	public async submit(): Promise<void> {
		await shell.openExternal(
			`https://github.com/${this.repository.owner}/${this.repository.name
			}/issues/new?title=${this.title}&body=${this.bodyTemplate()}`
		);
	}
	private bodyTemplate(): string {
		return encodeURIComponent(
			`### Description 🐊\n \`\`\`\n${this.description
			}\n\`\`\`\n\n### To Reproduce 🧵\nResponse... \n\n### Screenshots 📸\nResponse... \n\n### Additional Information ⚓️\nResponse...  \n\n### Configuration 🛠 \nApp Version ⛓: **${app.getVersion()}**\nPlatform 🖥: **${os.platform()} ${os.arch()}**\nRelease 📦: **${os.release()}**`
		);
	}

	private get appName() {
		return app
			.getName()
			.split('-')
			.join(' ')
			.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
	}

	public get repository(): IErrorReportRepository {
		return this._repository;
	}

	public set repository(value: IErrorReportRepository) {
		this._repository = value;
	}

	public get title(): string {
		return this._title;
	}

	public set title(value: string) {
		this._title = value;
	}

	public get description(): string {
		return this._description;
	}

	public set description(value: string) {
		this._description = value;
	}
}
