import { IDesktopGithubUpdate } from '../../interfaces';
import { IDesktopCdnUpdate } from '../../interfaces/i-desktop-cdn-update';
import { BaseCdnDecorator } from '../abstracts/base-cdn-decorator';

export class GithubCdn extends BaseCdnDecorator implements IDesktopGithubUpdate {
	private _CDN_HOST: string = 'https://github.com';

	constructor(update: IDesktopCdnUpdate) {
		super(update);
	} 

	public async initialize(): Promise<void> {
		const tag = await this.tagName();
		this.url = `${this._CDN_HOST}/${this.config.owner}/${this.config.repository}/${this.config.typeRelease}/download/${tag}`;
	}
}
