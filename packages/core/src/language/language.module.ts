import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { LanguageService } from './language.service';
import { LanguageController } from './language.controller';
import { Language } from './language.entity';
import { UserModule } from '../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/languages', module: LanguageModule }
		]),
		TypeOrmModule.forFeature([Language]),
		UserModule
	],
	controllers: [LanguageController],
	providers: [LanguageService],
	exports: [LanguageService]
})
export class LanguageModule {}
