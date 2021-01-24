import { ExtensionPlugin } from '@gauzy/plugin';
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
	onPluginBootstrap() {}
}
