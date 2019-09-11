import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationClients } from './organization-clients.entity';
import { OrganizationClientsController } from './organization-clients.controller';
import { OrganizationClientsService } from './organization-clients.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationClients]),
    ],
    controllers: [OrganizationClientsController],
    providers: [OrganizationClientsService],
    exports: [OrganizationClientsService],
})
export class OrganizationClientsModule { }
