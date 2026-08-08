import * as chalk from 'chalk';
import { SeederModule } from '@gauzy/core';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable } from '@gauzy/plugin';
import { DocsModule } from './docs.module';
import {
	Document,
	DocumentCategory,
	DocumentChunk,
	DocumentIndexState,
	DocumentLink,
	DocumentShare,
	DocumentVersion
} from './entities';
import { DocsRecoveryService } from './knowledge/queue/docs-recovery.service';
import { DocsSeederService } from './seeds/docs-seeder.service';
import { DocumentSubscriber } from './subscribers/document.subscriber';
import { DocumentVersionSubscriber } from './subscribers/document-version.subscriber';

@Plugin({
	imports: [DocsModule, SeederModule],
	entities: [Document, DocumentCategory, DocumentVersion, DocumentChunk, DocumentIndexState, DocumentShare, DocumentLink],
	subscribers: [DocumentSubscriber, DocumentVersionSubscriber],
	providers: [DocsSeederService]
})
export class DocsPlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private readonly logEnabled = true;

	constructor(
		private readonly docsSeederService: DocsSeederService,
		private readonly docsRecoveryService: DocsRecoveryService
	) {}

	/**
	 * Called when the plugin is being initialized. Schedules the delayed, non-blocking
	 * `docs-processing` startup recovery scan (§7.5 of the backend spec).
	 * (The AI-chat tool registration hooks in here in a later milestone.)
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${DocsPlugin.name} is being bootstrapped...`));
		}
		this.docsRecoveryService.scheduleStartupScan();
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		this.docsRecoveryService.cancelStartupScan();
		if (this.logEnabled) {
			console.log(chalk.red(`${DocsPlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Seed basic plugin data — reserved, no-op in v1.
	 */
	async onPluginBasicSeed() {
		await this.docsSeederService.seedBasic();
	}

	/**
	 * Seed default data: the 11 system categories + the starter folder/page per organization.
	 */
	async onPluginDefaultSeed() {
		try {
			await this.docsSeederService.seedDefault();

			if (this.logEnabled) {
				console.log(chalk.green(`Default data seeded successfully for ${DocsPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding default data:', error));
		}
	}

	/**
	 * Seed random (demo) data: demo folders, files, and pages so every filter chip has data.
	 */
	async onPluginRandomSeed() {
		try {
			await this.docsSeederService.seedRandom();

			if (this.logEnabled) {
				console.log(chalk.green(`Random data seeded successfully for ${DocsPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding random data:', error));
		}
	}
}
