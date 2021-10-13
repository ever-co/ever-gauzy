import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { HomeController } from './home.controller';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '',
				children: [
					{ path: '/', module: HomeModule }
				]
			}
		]),
	],
	controllers: [HomeController]
})
export class HomeModule {}
