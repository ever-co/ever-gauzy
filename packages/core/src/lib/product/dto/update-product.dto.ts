import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { CreateProductDTO } from './create-product.dto';

export class UpdateProductDTO extends IntersectionType(
	CreateProductDTO,
	PartialType(PickType(CreateProductDTO, ['type', 'category']))
) {}
