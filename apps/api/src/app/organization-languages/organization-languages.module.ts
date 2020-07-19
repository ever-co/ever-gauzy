import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationLanguages } from './organization-languages.entity';
import { OrganizationLanguagesController } from './organization-languages.controller';
import { OrganizationLanguagesService } from './organization-languages.service';

@Module({
	imports: [TypeOrmModule.forFeature([OrganizationLanguages])],
	controllers: [OrganizationLanguagesController],
	providers: [OrganizationLanguagesService],
	exports: [OrganizationLanguagesService]
})
export class OrganizationLanguagesModule {}
