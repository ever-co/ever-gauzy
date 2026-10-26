import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TaxLine } from './tax-line.entity';
import { TaxLineService } from './tax-line.service';
import { TypeOrmTaxLineRepository } from './repository/type-orm-tax-line.repository';
import { MikroOrmTaxLineRepository } from './repository/mikro-orm-tax-line.repository';

@Module({
	imports: [TypeOrmModule.forFeature([TaxLine]), MikroOrmModule.forFeature([TaxLine])],
	providers: [TaxLineService, TypeOrmTaxLineRepository, MikroOrmTaxLineRepository],
	exports: [TaxLineService, TypeOrmTaxLineRepository, MikroOrmTaxLineRepository]
})
export class TaxLineModule {}
