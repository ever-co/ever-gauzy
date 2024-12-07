import { ICommand } from '@nestjs/cqrs';

export class ProductVariantDeleteCommand implements ICommand {
	static readonly type = '[ProductVariant] Delete';

	constructor(public readonly productVariantId: string) {}
}
