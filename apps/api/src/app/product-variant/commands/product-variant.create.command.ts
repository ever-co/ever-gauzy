import { ICommand } from '@nestjs/cqrs';
import { IVariantCreateInput } from '@gauzy/models';

export class ProductVariantCreateCommand implements ICommand {
	static readonly type = '[ProductVariant] Register';

	constructor(public readonly productInput: IVariantCreateInput) {}
}
