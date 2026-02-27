import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Currency } from './currency.entity';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';
import { TypeOrmCurrencyRepository } from './repository/type-orm-currency.repository';
import { MikroOrmCurrencyRepository } from './repository/mikro-orm-currency.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Currency]), MikroOrmModule.forFeature([Currency])],
	controllers: [CurrencyController],
	providers: [CurrencyService, TypeOrmCurrencyRepository, MikroOrmCurrencyRepository],
	exports: [CurrencyService]
})
export class CurrencyModule {}