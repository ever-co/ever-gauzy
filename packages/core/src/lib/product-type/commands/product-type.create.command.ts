import { ICommand } from '@nestjs/cqrs';
import { IProductTypeTranslatable, LanguagesEnum } from '@gauzy/contracts';

export class ProductTypeCreateCommand implements ICommand {
	static readonly type = '[Product Type] Create';

	constructor(
		public readonly input: IProductTypeTranslatable,
		public readonly language: LanguagesEnum
	) {}
}
