import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ProductReview } from './entities/product-review.entity';
import { schemaExtensions } from './graphql/schema-extensions';

@Plugin({
	imports: [],
	entities: [ProductReview],
	extensions: {
		schema: schemaExtensions,
		resolvers: []
	}
})
export class ProductReviewsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${ProductReviewsPlugin.name} is being bootstrapped...`));
			console.log('ReviewsPlugin is being bootstrapped...');
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${ProductReviewsPlugin.name} is being destroyed...`));
		}
	}
}
