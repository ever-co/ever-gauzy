import { Module } from '@nestjs/common';
import { IntegrationMapController } from './integration-map.controller';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationMap]), CqrsModule],
	controllers: [IntegrationMapController],
	providers: [IntegrationMapService, ...CommandHandlers],
})
export class IntegrationMapModule {}
