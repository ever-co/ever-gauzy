import { CorePlugin } from '@gauzy/plugin';
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
export class ReviewsPlugin { }
