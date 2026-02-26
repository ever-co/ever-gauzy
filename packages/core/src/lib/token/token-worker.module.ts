import { Module } from "@nestjs/common";
import { TokenModule } from "./token.module";

@Module({
	imports: [
		TokenModule.forRoot({
			enableScheduler: true
		}),
	]
})
export class TokenWorkerModule {}
