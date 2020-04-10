import { Module } from '@nestjs/common';
import { IntegrationMapController } from './integration-map.controller';
import { IntegrationMapService } from './integration-map.service';
import { IntegrationMap } from './integration-map.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
	imports: [TypeOrmModule.forFeature([IntegrationMap])],
	controllers: [IntegrationMapController],
	providers: [IntegrationMapService]
})
export class IntegrationMapModule {}
