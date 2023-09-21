import { ModuleMetadata } from '@nestjs/common';

export interface ProbotConfig {
	appId: string;
	privateKey: string;

	webhookSecret?: string;
	webhookPath?: string;

	ghUrl?: string;

	clientId: string;
	clientSecret: string;

	webhookProxy?: string;
}

export interface OctokitConfig {
	auth: Record<string, any>;
	probot: ProbotConfig;
}

export interface ProbotModuleOptions {
	isGlobal?: boolean;
	path: string;
	config: ProbotConfig;
}

export interface ProbotModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	isGlobal?: boolean;
	path: string;
	useFactory: (...args: any[]) => Promise<ProbotConfig> | ProbotConfig;
	inject?: any[];
}

export enum ProbotMetadata {
	name = 'probot/metadata/hook',
}

export enum ModuleProviders {
	ProbotConfig = 'probot/provider/config',
}
