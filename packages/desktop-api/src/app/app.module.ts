import { Module } from '@nestjs/common';
import { WakatimeModule } from '@gauzy/integration-wakatime';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database.module';

require('app-root-path').setPath(process.env.GAUZY_USER_PATH);

@Module({
	imports: [DatabaseModule, WakatimeModule],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
