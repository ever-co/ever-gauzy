import { ICommand } from '@nestjs/cqrs';
import { Product } from '../../product/product.entity';

export class ProductCreateCommand implements ICommand {
	static readonly type = '[Product] Register';

	constructor(public readonly productInput: Product) {}
}
