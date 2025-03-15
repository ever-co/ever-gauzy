import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { handlers } from './application/handlers';
import { entities } from './domain/entities';
import { services } from './domain/services';
import { PluginController } from './infrastructure/controllers/plugin.controller';
import { repositories } from './domain/repositories';

@Module({
	controllers: [PluginController],
	imports: [TypeOrmModule.forFeature([...entities]), MikroOrmModule.forFeature([...entities]), CqrsModule],
	providers: [...services, ...handlers, ...repositories]
})
export class PluginRegistryModule {}
