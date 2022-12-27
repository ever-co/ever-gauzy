import { promisify } from 'node:util';
import childProcess from 'node:child_process';
import { IDesktopCdnUpdate } from '../../interfaces/i-desktop-cdn-update';
import { BaseCdnDecorator } from '../abstracts/base-cdn-decorator';
import { app } from 'electron';

export class GithubCdn extends BaseCdnDecorator implements IDesktopCdnUpdate {
	private _CDN_HOST: string = 'https://github.com';

	constructor(update: IDesktopCdnUpdate) {
		super(update);
		(async () => {
			const latests = await this._remoteGitTags();
			const tag: string = latests[0];
			this.url = `${this._CDN_HOST}/${this.config.owner}/${this.config.repository}/${this.config.typeRelease}/download/${tag}`;
		})();
	}

	private async _remoteGitTags() {
		const execFile = promisify(childProcess.execFile);
		const tags = [];
		const { stdout } = await execFile('git', [
			'ls-remote',
			'--tags',
			'--sort=-v:refname',
			`${this._CDN_HOST}/${this.config.owner}/${this.config.repository}`
		]);

		for (const line of stdout.trim().split('\n')) {
			const [, tagReference] = line.split('\t');
			const regex = new RegExp('-', 'g');
			const tagName = tagReference
				.replace(/^refs\/tags\//, '')
				.replace(/\^{}$/, '');
			if (!regex.test(tagName)) {
				tags.push(tagName);
			}
		}

		return tags;
	}
}
