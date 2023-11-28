import { ModuleMetadata } from '@nestjs/common';

export interface JiraConfig {
	// Jira App configuration options
	appName: string;
	appDescription: string;
	appKey: string;
	baseUrl: string;
	vendorName: string;
	vendorUrl: string;
}

export interface JiraModuleOptions {
	// Specifies if the Jira module should be global
	isGlobal?: boolean;
	// Jira configuration options
	config: JiraConfig;
}

export interface JiraModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	// Specifies if the Jira module should be global
	isGlobal?: boolean;
	// Jira configuration options
	config: JiraConfig;
	// Factory function to asynchronously provide Jira configuration
	useFactory: (...args: any[]) => Promise<JiraConfig> | JiraConfig;
	// Optional list of dependencies to inject into the factory function
	inject?: any[];
}

export enum ModuleProviders {
	// Provider key for Jira configuration
	JiraConfig = 'jira/provider/config'
}
