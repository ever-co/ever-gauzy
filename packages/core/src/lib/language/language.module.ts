import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { LanguageService } from './language.service';
import { LanguageController } from './language.controller';
import { Language } from './language.entity';
import { TypeOrmLanguageRepository } from './repository/type-orm-language.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Language]), MikroOrmModule.forFeature([Language])],
	controllers: [LanguageController],
	providers: [LanguageService, TypeOrmLanguageRepository],
	exports: [LanguageService]
})
export class LanguageModule {}
