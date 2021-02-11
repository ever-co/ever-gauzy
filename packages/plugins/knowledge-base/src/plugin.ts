import { IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/common';
import {
	ExtensionPlugin,
	OnDefaultPluginSeed,
	OnRandomPluginSeed
} from '@gauzy/plugin';
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
export class KnowledgeBasePlugin
	implements
		IOnPluginBootstrap,
		IOnPluginDestroy,
		OnDefaultPluginSeed,
		OnRandomPluginSeed {
	constructor() {}

	onPluginBootstrap() {
		console.log(
			chalk.green(
				`The plugin ${this.constructor.name} has been boostraped.`
			)
		);
	}

	onPluginDestroy() {
		console.log(
			chalk.green(
				`The plugin ${this.constructor.name} has been destroyed.`
			)
		);
	}

	onDefaultPluginSeed() {
		console.log('run default seed');
	}

	onRandomPluginSeed() {
		console.log('run random seed');
	}
}
