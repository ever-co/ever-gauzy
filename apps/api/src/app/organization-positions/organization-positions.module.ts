import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationPositions } from './organization-positions.entity';
import { OrganizationPositionsController } from './organization-positions.controller';
import { OrganizationPositionsService } from './organization-positions.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationPositions]),
    ],
    controllers: [OrganizationPositionsController],
    providers: [OrganizationPositionsService],
    exports: [OrganizationPositionsService],
})
export class OrganizationPositionsModule { }
