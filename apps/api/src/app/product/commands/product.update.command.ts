import { ICommand } from '@nestjs/cqrs';
import { Product } from '../../product/product.entity';

export class ProductUpdateCommand implements ICommand {
	static readonly type = '[Product] Update';

	constructor(
		public readonly id: string,
		public readonly productUpdateRequest: Product
	) {}
}
