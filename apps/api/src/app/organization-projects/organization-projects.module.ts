import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationProjects } from './organization-projects.entity';
import { OrganizationProjectsController } from './organization-projects.controller';
import { OrganizationProjectsService } from './organization-projects.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationProjects]),
    ],
    controllers: [OrganizationProjectsController],
    providers: [OrganizationProjectsService],
    exports: [OrganizationProjectsService],
})
export class OrganizationProjectsModule { }
