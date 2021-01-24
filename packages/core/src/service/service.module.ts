import { DatabaseModule } from './database.module';
import { DynamicModule, Module } from '@nestjs/common';

@Module({
	imports: [],
	providers: [],
	exports: []
})
export class CoreModule {}

@Module({
	imports: [CoreModule],
	exports: [CoreModule]
})
export class ServiceModule {
	static forRoot(): DynamicModule {
		const { imports } = DatabaseModule.forRoot();
		return {
			module: ServiceModule,
			imports
		} as DynamicModule;
	}
}
