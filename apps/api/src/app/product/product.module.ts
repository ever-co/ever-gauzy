import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { Product } from './product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { ProductOption } from '../product-option/product-option.entity';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductOptionService } from '../product-option/product-option.service';
import { ProductCreateHandler } from './commands/handlers/product.create.handler';

@Module({
	imports: [TypeOrmModule.forFeature([Product, ProductOption]), CqrsModule],
	controllers: [ProductController],
	providers: [ProductService, ProductOptionService, ProductCreateHandler],
	exports: [ProductService]
})
export class ProductModule {}
