import { i4netCorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ProductReview } from './entities/product-review.entity';
import { schemaExtensions } from './graphql/schema-extensions';

@i4netCorePlugin({
	imports: [],
	entities: [ProductReview],
	extensions: {
		schema: schemaExtensions,
		resolvers: []
	}
})
export class ReviewsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('ReviewsPlugin is being bootstrapped...');
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('ReviewsPlugin is being destroyed...');
		}
	}
}
