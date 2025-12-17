import { isMySQL } from '@gauzy/config';
import { ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, ValidateIf } from 'class-validator';
import { Index, JoinColumn, RelationId } from 'typeorm';
import { IPluginInstallation } from '../../shared/models/plugin-installation.model';
import { IPluginSource } from '../../shared/models/plugin-source.model';
import { IPluginVersion } from '../../shared/models/plugin-version.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { MikroOrmPluginVersionRepository } from '../repositories/mikro-orm-plugin-version.repository';
import { PluginInstallation } from './plugin-installation.entity';
import { PluginSource } from './plugin-source.entity';
import { Plugin } from './plugin.entity';

@Index(isMySQL ? ['pluginId', 'organizationId', 'number'] : ['pluginId', 'tenantId', 'organizationId', 'number'], {
	unique: true
})
@Index(['tenantId', 'organizationId'])
@Index(['pluginId', 'releaseDate'])
@Index(['number'])
@Index(['downloadCount'])
@MultiORMEntity('plugin_versions', { mikroOrmRepository: () => MikroOrmPluginVersionRepository })
export class PluginVersion extends TenantOrganizationBaseEntity implements IPluginVersion {
	@ApiProperty({
		type: () => String,
		description: 'Version following SemVer (MAJOR.MINOR.PATCH[-prerelease][+build])'
	})
	@IsNotEmpty({ message: 'Version is required' })
	@IsString({ message: 'Version must be a string' })
	@Matches(/^(\d+\.\d+\.\d+)(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/, {
		message: 'Version must follow SemVer format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]'
	})
	@MultiORMColumn()
	number: string;

	@ApiProperty({ type: () => String, description: 'Change Log of the plugin version' })
	@IsNotEmpty({ message: 'Change Log is required' })
	@IsString({ message: 'Change Log must be a string' })
	@MultiORMColumn()
	changelog: string;

	@ApiProperty({ type: () => String, description: 'Verification hash of the plugin version' })
	@IsOptional()
	@IsString({ message: 'Checksum must be a string' })
	@MultiORMColumn({ nullable: true })
	checksum?: string;

	@ApiProperty({ type: () => String, description: 'Digital signature for authenticity verification' })
	@IsOptional()
	@IsString({ message: 'Signature must be a string' })
	@MultiORMColumn({ nullable: true })
	signature?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Date when the release was recorded' })
	@IsOptional()
	@IsDateString({}, { message: 'Release date must be a valid ISO 8601 date string' })
	@ValidateIf((o) => o.releaseDate !== null && o.releaseDate !== undefined)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	releaseDate: Date;

	@ApiProperty({ type: () => Number, description: 'Download count' })
	@IsOptional()
	@IsNumber({}, { message: 'Download count must be a number' })
	@Min(0, { message: 'Download count must be greater than or equal to 0' })
	@Transform(({ value }) => (value ? parseFloat(value) : 0), { toClassOnly: true })
	@MultiORMColumn({ nullable: true, default: 0 })
	downloadCount: number;

	@ApiProperty({ type: () => Plugin, description: 'Plugin associated with the version', required: true })
	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.versions, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	plugin?: IPlugin;

	@RelationId((version: PluginVersion) => version.plugin)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	pluginId?: ID;

	@ApiProperty({ type: () => [PluginSource], description: 'Sources of the plugin version', required: false })
	@MultiORMOneToMany(() => PluginSource, (source) => source.version, { nullable: true, onDelete: 'CASCADE' })
	sources?: IPluginSource[];

	@ApiProperty({
		type: () => [PluginInstallation],
		description: 'Related installations to plugin version',
		required: false
	})
	@MultiORMOneToMany(() => PluginInstallation, (source) => source.version, { nullable: true, onDelete: 'CASCADE' })
	installations?: IPluginInstallation[];

	// Business Logic Methods

	/**
	 * Check if this version follows semantic versioning
	 */
	public isValidSemVer(): boolean {
		const semVerPattern = /^(\d+\.\d+\.\d+)(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;
		return semVerPattern.test(this.number);
	}

	/**
	 * Compare this version with another version
	 * @param other - The version to compare with
	 * @returns -1 if this < other, 0 if equal, 1 if this > other
	 */
	public compareVersion(other: IPluginVersion): number {
		if (!this.isValidSemVer() || !other.number) {
			return 0;
		}

		const thisParts = this.number.split('.').map(Number);
		const otherParts = other.number.split('.').map(Number);

		for (let i = 0; i < Math.max(thisParts.length, otherParts.length); i++) {
			const thisPart = thisParts[i] || 0;
			const otherPart = otherParts[i] || 0;

			if (thisPart < otherPart) return -1;
			if (thisPart > otherPart) return 1;
		}

		return 0;
	}

	/**
	 * Check if this is a pre-release version
	 */
	public isPreRelease(): boolean {
		return this.number.includes('-');
	}

	/**
	 * Check if this version has sources for a specific platform
	 */
	public hasSupportForPlatform(osType: any, arch: any): boolean {
		if (!this.sources || this.sources.length === 0) {
			return false;
		}

		return this.sources.some((source) => source.operatingSystem === osType && source.architecture === arch);
	}

	/**
	 * Get sources for a specific platform
	 */
	public getSourcesForPlatform(osType: any, arch: any): IPluginSource[] {
		if (!this.sources) {
			return [];
		}

		return this.sources.filter((source) => source.operatingSystem === osType && source.architecture === arch);
	}

	/**
	 * Increment download count
	 */
	public incrementDownloadCount(): void {
		this.downloadCount = (this.downloadCount || 0) + 1;
	}

	/**
	 * Check if version has security verification (checksum or signature)
	 */
	public hasSecurityVerification(): boolean {
		return !!(this.checksum || this.signature);
	}

	/**
	 * Get age of the version in days
	 */
	public getAgeInDays(): number {
		if (!this.releaseDate) {
			return 0;
		}

		const now = new Date();
		const releaseDate = new Date(this.releaseDate);
		const diffTime = Math.abs(now.getTime() - releaseDate.getTime());
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}

	/**
	 * Check if this version is newer than a given number of days
	 */
	public isNewerThan(days: number): boolean {
		return this.getAgeInDays() <= days;
	}

	/**
	 * Validate version data integrity
	 */
	public validate(): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!this.number) {
			errors.push('Version number is required');
		} else if (!this.isValidSemVer()) {
			errors.push('Version number must follow SemVer format');
		}

		if (!this.changelog) {
			errors.push('Changelog is required');
		}

		if (!this.sources || this.sources.length === 0) {
			errors.push('At least one source is required');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	// Static Methods

	/**
	 * Create a new plugin version instance
	 */
	public static create(data: Partial<PluginVersion>): PluginVersion {
		const version = new PluginVersion();
		Object.assign(version, {
			downloadCount: 0,
			releaseDate: new Date(),
			sources: [],
			installations: [],
			...data
		});
		return version;
	}

	/**
	 * Validate SemVer format
	 */
	public static isValidSemVer(version: string): boolean {
		if (!version || typeof version !== 'string') return false;
		const semVerPattern = /^(\d+\.\d+\.\d+)(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;
		return semVerPattern.test(version);
	}

	/**
	 * Parse SemVer components
	 */
	public static parseSemVer(version: string): {
		major: number;
		minor: number;
		patch: number;
		prerelease?: string;
		build?: string;
	} | null {
		if (!this.isValidSemVer(version)) return null;

		const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.*?))?(?:\+(.*))?$/);
		if (!match) return null;

		return {
			major: parseInt(match[1], 10),
			minor: parseInt(match[2], 10),
			patch: parseInt(match[3], 10),
			prerelease: match[4],
			build: match[5]
		};
	}

	/**
	 * Compare two version strings
	 */
	public static compareVersions(a: string, b: string): number {
		const parsedA = this.parseSemVer(a);
		const parsedB = this.parseSemVer(b);

		if (!parsedA || !parsedB) return 0;

		// Compare major.minor.patch
		if (parsedA.major !== parsedB.major) {
			return parsedA.major - parsedB.major;
		}
		if (parsedA.minor !== parsedB.minor) {
			return parsedA.minor - parsedB.minor;
		}
		if (parsedA.patch !== parsedB.patch) {
			return parsedA.patch - parsedB.patch;
		}

		// Handle prerelease comparison
		if (!parsedA.prerelease && !parsedB.prerelease) return 0;
		if (parsedA.prerelease && !parsedB.prerelease) return -1;
		if (!parsedA.prerelease && parsedB.prerelease) return 1;

		// Both have prerelease, compare lexicographically
		return parsedA.prerelease!.localeCompare(parsedB.prerelease!);
	}

	/**
	 * Sort versions by semantic version (latest first)
	 */
	public static sortVersions(versions: PluginVersion[]): PluginVersion[] {
		return [...versions].sort((a, b) => this.compareVersions(b.number, a.number));
	}

	/**
	 * Find the latest version from an array
	 */
	public static findLatest(versions: PluginVersion[]): PluginVersion | undefined {
		if (!versions || versions.length === 0) return undefined;
		return this.sortVersions(versions)[0];
	}

	/**
	 * Filter prerelease versions
	 */
	public static filterPrerelease(versions: PluginVersion[]): PluginVersion[] {
		return versions.filter((version) => version.isPreRelease());
	}

	/**
	 * Filter stable versions (no prerelease)
	 */
	public static filterStable(versions: PluginVersion[]): PluginVersion[] {
		return versions.filter((version) => !version.isPreRelease());
	}

	/**
	 * Filter versions by age (newer than specified days)
	 */
	public static filterByAge(versions: PluginVersion[], maxAgeInDays: number): PluginVersion[] {
		return versions.filter((version) => version.isNewerThan(maxAgeInDays));
	}

	/**
	 * Generate next patch version
	 */
	public static generateNextPatch(currentVersion: string): string | null {
		const parsed = this.parseSemVer(currentVersion);
		if (!parsed || parsed.prerelease) return null;
		return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
	}

	/**
	 * Generate next minor version
	 */
	public static generateNextMinor(currentVersion: string): string | null {
		const parsed = this.parseSemVer(currentVersion);
		if (!parsed || parsed.prerelease) return null;
		return `${parsed.major}.${parsed.minor + 1}.0`;
	}

	/**
	 * Generate next major version
	 */
	public static generateNextMajor(currentVersion: string): string | null {
		const parsed = this.parseSemVer(currentVersion);
		if (!parsed || parsed.prerelease) return null;
		return `${parsed.major + 1}.0.0`;
	}

	/**
	 * Check if version satisfies a range (basic implementation)
	 */
	public static satisfiesRange(version: string, range: string): boolean {
		// Basic implementation for common patterns
		if (range === '*') return true;
		if (range.startsWith('^')) {
			const targetVersion = range.substring(1);
			const target = this.parseSemVer(targetVersion);
			const current = this.parseSemVer(version);
			if (!target || !current) return false;
			return current.major === target.major && this.compareVersions(version, targetVersion) >= 0;
		}
		if (range.startsWith('~')) {
			const targetVersion = range.substring(1);
			const target = this.parseSemVer(targetVersion);
			const current = this.parseSemVer(version);
			if (!target || !current) return false;
			return (
				current.major === target.major &&
				current.minor === target.minor &&
				this.compareVersions(version, targetVersion) >= 0
			);
		}
		return version === range;
	}

	/**
	 * Get version statistics for a collection
	 */
	public static getStatistics(versions: PluginVersion[]): {
		total: number;
		stable: number;
		prerelease: number;
		totalDownloads: number;
		latest?: string;
		oldest?: string;
	} {
		const stats = {
			total: versions.length,
			stable: 0,
			prerelease: 0,
			totalDownloads: 0,
			latest: null,
			oldest: null
		};

		versions.forEach((version) => {
			if (version.isPreRelease()) {
				stats.prerelease++;
			} else {
				stats.stable++;
			}
			stats.totalDownloads += version.downloadCount || 0;
		});

		const sorted = this.sortVersions(versions);
		if (sorted.length > 0) {
			stats.latest = sorted[0].number;
			stats.oldest = sorted[sorted.length - 1].number;
		}

		return stats;
	}
}
