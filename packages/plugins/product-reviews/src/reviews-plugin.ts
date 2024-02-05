import { CorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ProductReview } from './entities/product-review.entity';
import { schemaExtensions } from './graphql/schema-extensions';

@CorePlugin({
	imports: [],
	entities: [ProductReview],
	extensions: {
		schema: schemaExtensions,
		resolvers: []
	}
})
export class ReviewsPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	private logging: boolean = true;

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logging) {
			console.log('ReviewsPlugin is being bootstrapped...');
			// Your existing logic here...
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logging) {
			console.log('ReviewsPlugin is being destroyed...');
			// Your existing logic here...
		}
	}
}
