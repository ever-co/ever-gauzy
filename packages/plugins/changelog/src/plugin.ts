import { SeederModule } from '@gauzy/core';
import { IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/common';
import { ExtensionPlugin, OnDefaultPluginSeed } from '@gauzy/plugin';
import { ChangelogModule } from './changelog.module';
import { Changelog } from './changelog.entity';
import { ChangelogSeederService } from './changelog-seeder.service';

@ExtensionPlugin({
	imports: [ChangelogModule, SeederModule],
	entities: [Changelog],
	providers: [ChangelogSeederService]
})
export class ChangelogPlugin
	implements IOnPluginBootstrap, IOnPluginDestroy, OnDefaultPluginSeed {
	constructor(
		private readonly changelogSeederService: ChangelogSeederService
	) {}

	onPluginBootstrap() {}

	onPluginDestroy() {}

	onDefaultPluginSeed() {
		this.changelogSeederService.createDefault();
	}
}
