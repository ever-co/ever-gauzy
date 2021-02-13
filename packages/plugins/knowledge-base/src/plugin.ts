import { SeedDataService } from '@gauzy/core';
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
import { HelpCenterSeederService } from './help-center-seeder.service';

@ExtensionPlugin({
	imports: [
		HelpCenterModule,
		HelpCenterArticleModule,
		HelpCenterAuthorModule
	],
	entities: [HelpCenter, HelpCenterArticle, HelpCenterAuthor],
	providers: [SeedDataService, HelpCenterSeederService]
})
export class KnowledgeBasePlugin
	implements
		IOnPluginBootstrap,
		IOnPluginDestroy,
		OnDefaultPluginSeed,
		OnRandomPluginSeed {
	constructor(
		private readonly helpCenterSeederService: HelpCenterSeederService
	) {}

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
		this.helpCenterSeederService.createDefault();
	}

	onRandomPluginSeed() {
		this.helpCenterSeederService.createRandom();
	}
}
