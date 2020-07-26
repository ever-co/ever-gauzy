import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WakatimeModule } from './wakatime/wakatime.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { app } from 'electron';
import { Wakatime } from './wakatime/wakatime.entity';
import { Projects } from './wakatime/projects.entity';
import { Languages } from './wakatime/language.entity';
import { Machine } from './wakatime/machine.entity';
import { Branches } from './wakatime/branches.entity';
import { Os } from './wakatime/os.entity';

console.log(__dirname);
@Module({
	imports: [
		TypeOrmModule.forRoot({
			type: 'sqlite',
			database: app
				? `${app.getPath('userData')}/metrix.sqlite`
				: '/Users/Ari/Library/Application Support/gauzy-desktop/metrix.sqlite',
			keepConnectionAlive: true,
			logging: true,
			synchronize: true,
			entities: [Wakatime, Projects, Languages, Machine, Branches, Os]
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
