import { ExtensionPlugin } from '../../extension-plugin';
import { ProductReview } from './entities/product-review.entity';
import { schemaExtensions } from './graphql/schema-extensions';

@ExtensionPlugin({
	imports: [],
	entities: [ProductReview],
	extensions: {
		schema: schemaExtensions,
		resolvers: []
	}
})
export class ReviewsPlugin {
	onPluginBootstrap() {
		console.log('plugin bootstraped successfully');
	}
}
