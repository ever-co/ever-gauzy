import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@gauzy/config';

let defaultTypeOrmModule: DynamicModule;
@Module({
	imports: [],
	exports: []
})
export class DatabaseModule {
	static forRoot(): DynamicModule {
		if (!defaultTypeOrmModule) {
			defaultTypeOrmModule = TypeOrmModule.forRootAsync({
				imports: [ConfigModule],
				useFactory: (configService: ConfigService) => {
					const { dbConnectionOptions } = configService.config;
					return {
						name: 'default',
						...dbConnectionOptions
					};
				},
				inject: [ConfigService]
			});
		}
		return {
			module: DatabaseModule,
			imports: [defaultTypeOrmModule]
		};
	}
}
