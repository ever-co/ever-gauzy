import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';

@Module({
	controllers: [HomeController]
})
export class HomeModule {}
