import { ICommand } from '@nestjs/cqrs';

export class ProductDeleteCommand implements ICommand {
	static readonly type = '[Product] Delete';

	constructor(public readonly productId: string) {}
}
