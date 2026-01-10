import type { ID, IPluginVersion as PluginVersionModel } from '@gauzy/contracts';
import type { IPluginSource, IPluginSourceUpdate } from './plugin-source.model';

export interface IPluginVersionUpdate extends Partial<Pick<IPluginVersion, 'number' | 'changelog' | 'releaseDate'>> {
	id: ID;
	sources?: IPluginSourceUpdate[];
}

export interface IPluginVersion extends PluginVersionModel {
	// Business Logic Methods
	isValidSemVer(): boolean;
	compareVersion(other: IPluginVersion): number;
	isPreRelease(): boolean;
	hasSupportForPlatform(osType: any, arch: any): boolean;
	getSourcesForPlatform(osType: any, arch: any): IPluginSource[];
	incrementDownloadCount(): void;
	hasSecurityVerification(): boolean;
	getAgeInDays(): number;
	isNewerThan(days: number): boolean;
	validate(): { isValid: boolean; errors: string[] };
}

/**
 * Static methods interface for PluginVersion class
 */
export interface IPluginVersionStatic {
	create(data: Partial<IPluginVersion>): IPluginVersion;
	isValidSemVer(version: string): boolean;
	parseSemVer(version: string): {
		major: number;
		minor: number;
		patch: number;
		prerelease?: string;
		build?: string;
	} | null;
	compareVersions(a: string, b: string): number;
	sortVersions(versions: IPluginVersion[]): IPluginVersion[];
	findLatest(versions: IPluginVersion[]): IPluginVersion | undefined;
	filterPrerelease(versions: IPluginVersion[]): IPluginVersion[];
	filterStable(versions: IPluginVersion[]): IPluginVersion[];
	filterByAge(versions: IPluginVersion[], maxAgeInDays: number): IPluginVersion[];
	generateNextPatch(currentVersion: string): string | null;
	generateNextMinor(currentVersion: string): string | null;
	generateNextMajor(currentVersion: string): string | null;
	satisfiesRange(version: string, range: string): boolean;
	getStatistics(versions: IPluginVersion[]): {
		total: number;
		stable: number;
		prerelease: number;
		totalDownloads: number;
		latest?: string;
		oldest?: string;
	};
}
