import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WakatimeModule } from './wakatime/wakatime.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wakatime } from './wakatime/wakatime.entity';

@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'sqlite',
			database: process.env.GAUZY_USER_PATH
				? `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`
				: '',
			keepConnectionAlive: true,
			logging: true,
			synchronize: true,
			entities: [Wakatime]
		}),
		RouterModule.forRoutes([
			{
				path: '',
				children: [
					{ path: '/v1/users/current', module: WakatimeModule }
				]
			}
		]),
		WakatimeModule
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
