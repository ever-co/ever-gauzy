import { LanguageService } from './language.service';
import { LanguageController } from './language.controller';
import { Language } from './language.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';

@Module({
	imports: [TypeOrmModule.forFeature([Language]), UserModule],
	controllers: [LanguageController],
	providers: [LanguageService],
	exports: [LanguageService]
})
export class LanguageModule {}
