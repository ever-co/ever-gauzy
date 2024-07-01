import { ModuleMetadata } from '@nestjs/common';

// Define interfaces for Probot and Octokit configuration

export interface ProbotConfig {
	// GitHub App configuration options
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
	// Octokit library configuration options
	auth?: Record<string, any>;
	probot: ProbotConfig;
}

// Define options for the Probot module

export interface ProbotModuleOptions {
	// Specifies if the Probot module should be global
	isGlobal?: boolean;
	// The path at which the module is mounted
	path: string;
	// Probot configuration options
	config: ProbotConfig;
}

export interface ProbotModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	// Specifies if the Probot module should be global
	isGlobal?: boolean;
	// The path at which the module is mounted
	path: string;
	// Factory function to asynchronously provide Probot configuration
	useFactory: (...args: any[]) => Promise<ProbotConfig> | ProbotConfig;
	// Optional list of dependencies to inject into the factory function
	inject?: any[];
}

// Define enums for metadata and module providers
export enum ProbotMetadata {
	name = 'probot/metadata/hook'
}

export enum ModuleProviders {
	// Provider key for Probot configuration
	ProbotConfig = 'probot/provider/config'
}
