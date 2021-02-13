import { IOnPluginBootstrap } from '@gauzy/common';
import { ExtensionPlugin } from '@gauzy/plugin';
import * as chalk from 'chalk';
import { HelpCenterAuthor, HelpCenterAuthorModule } from './help-center-author';
import { HelpCenter, HelpCenterModule } from './help-center';
import {
	HelpCenterArticle,
	HelpCenterArticleModule
} from './help-center-article';

@ExtensionPlugin({
	imports: [
		HelpCenterModule,
		HelpCenterArticleModule,
		HelpCenterAuthorModule
	],
	entities: [HelpCenter, HelpCenterArticle, HelpCenterAuthor]
})
export class KnowledgeBasePlugin implements IOnPluginBootstrap {
	constructor() {}

	onPluginBootstrap() {
		console.log(
			chalk.green(
				`The plugin ${this.constructor.name} has been boostraped.`
			)
		);
	}
}
