import { ModuleMetadata } from '@nestjs/common';

/**
 * Jira configuration options
 */
export interface JiraConfig {
	// Name of the Jira application
	appName: string;
	// Description of the Jira application
	appDescription: string;
	// Key identifier for the Jira application
	appKey: string;
	// Base URL of the Jira instance
	baseUrl: string;
	// Vendor name of the Jira application
	vendorName: string;
	// Vendor URL of the Jira application
	vendorUrl: string;
}

/**
 * Jira Module options
 */
export interface JiraModuleOptions {
	// Specifies if the Jira module should be global
	isGlobal?: boolean;
	// The path at which the module is mounted
	path: string;
	// Jira configuration options
	config: JiraConfig;
}

/**
 * Jira Module async options
 */
export interface JiraModuleAsyncOptions extends JiraModuleOptions, Pick<ModuleMetadata, 'imports'> {
	// Factory function to asynchronously provide Jira configuration
	useFactory: (...args: any[]) => Promise<JiraConfig> | JiraConfig;
	// Optional list of dependencies to inject into the factory function
	inject?: any[];
}

/**
 * Jira Module providers
 */
export enum ModuleProviders {
	// Provider key for Jira configuration
	JiraConfig = 'jira/provider/config'
}
