import { Module } from "@nestjs/common";
import { TOKEN_WORKER_ENABLED } from "./token-constant";
import { TokenModule } from "./token.module";

@Module({
	imports: [
		TokenModule.forRoot({
			enableScheduler: TOKEN_WORKER_ENABLED
		}),
	]
})
export class TokenWorkerModule {}
