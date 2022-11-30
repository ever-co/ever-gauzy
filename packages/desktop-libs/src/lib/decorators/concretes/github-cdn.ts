import { IDesktopCdnUpdate } from "../../interfaces/i-desktop-cdn-update";
import { BaseCdnDecorator } from "../abstracts/base-cdn-decorator";

export class GithubCdn
    extends BaseCdnDecorator
    implements IDesktopCdnUpdate {
    private _CDN_HOST: string = 'https://github.com'
    constructor(update: IDesktopCdnUpdate) {
        super(update);
		(async () => {
			const res: any = await this.tagName();
			this.url = res
				? `${this._CDN_HOST}/${this.config.owner}/${this.config.repository}/${this.config.typeRelease}/download/${res.tag_name}`
				: null;
		})();
    }
}
