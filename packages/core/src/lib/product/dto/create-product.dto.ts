import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmptyObject, IsObject, IsOptional, IsString } from 'class-validator';
import {
	IProductCategoryTranslatable,
	IProductCreateInput,
	IProductOptionGroupTranslatable,
	IProductOptionTranslatable,
	IProductTranslation,
	IProductTypeTranslatable
} from '@gauzy/contracts';
import { ProductDTO } from './product.dto';

export class CreateProductDTO extends ProductDTO implements IProductCreateInput {
	@ApiProperty({ type: () => Object })
	@IsObject()
	@IsNotEmptyObject()
	readonly type: IProductTypeTranslatable;

	@ApiProperty({ type: () => Object })
	@IsObject()
	@IsNotEmptyObject()
	readonly category: IProductCategoryTranslatable;

	@ApiPropertyOptional({ type: () => Object, isArray: true })
	@IsOptional()
	@IsArray()
	readonly optionGroupUpdateInputs: IProductOptionGroupTranslatable[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsArray()
	readonly optionGroupCreateInputs: IProductOptionGroupTranslatable[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsArray()
	readonly optionGroupDeleteInputs: IProductOptionGroupTranslatable[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsArray()
	readonly optionDeleteInputs: IProductOptionTranslatable[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsArray()
	readonly translations: IProductTranslation[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly language: string;
}
