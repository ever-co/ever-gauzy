import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wakatime } from '@gauzy/wakatime';
import { WakatimeModule } from '@gauzy/wakatime';
require('app-root-path').setPath(process.env.GAUZY_USER_PATH);

@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'sqlite',
			database: process.env.GAUZY_USER_PATH
				? `${process.env.GAUZY_USER_PATH}/gauzy.sqlite3`
				: '',
			keepConnectionAlive: true,
			logging: true,
			logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
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
