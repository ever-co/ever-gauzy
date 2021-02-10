import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Currency } from './currency.entity';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/currency', module: CurrencyModule }]),
		TypeOrmModule.forFeature([Currency])
	],
	controllers: [CurrencyController],
	providers: [CurrencyService],
	exports: [CurrencyService]
})
export class CurrencyModule {}
