import { ICommand } from '@nestjs/cqrs';
import { Product } from '../../product/product.entity';

export class ProductVariantCreateCommand implements ICommand {
	static readonly type = '[ProductVariant] Register';

	constructor(public readonly productInput: Product) {}
}
