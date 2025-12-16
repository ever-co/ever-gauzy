import { TagService } from '@gauzy/core';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IPluginTagBulkCreateResponse } from '../../../../shared';
import { AutoTagPluginCommand } from '../auto-tag-plugin.command';
import { BulkCreatePluginTagsCommand } from '../bulk-create-plugin-tags.command';

/**
 * Handler for automatically tagging plugins based on their properties
 */
@CommandHandler(AutoTagPluginCommand)
@Injectable()
export class AutoTagPluginHandler implements ICommandHandler<AutoTagPluginCommand> {
	private readonly logger = new Logger(AutoTagPluginHandler.name);

	constructor(private readonly tagService: TagService, private readonly commandBus: CommandBus) {}

	/**
	 * Execute the auto-tag plugin command
	 *
	 * @param command - The auto-tag command
	 * @returns Promise<IPluginTagBulkCreateResponse>
	 */
	async execute(command: AutoTagPluginCommand): Promise<IPluginTagBulkCreateResponse> {
		try {
			this.logger.log(`Auto-tagging plugin: ${command.pluginId}`);

			const { pluginId, pluginData, options = {} } = command;
			const { createMissingTags = true, tenantId, organizationId } = options;

			// Extract potential tag names from plugin data
			const extractedTags = this.extractTagsFromPluginData(pluginData);

			if (extractedTags.length === 0) {
				this.logger.warn(`No tags could be extracted for plugin: ${pluginId}`);
				return {
					created: 0,
					existing: 0,
					pluginTags: []
				};
			}

			// Check which tags already exist by fetching each tag individually
			const existingTags = [];
			const tagsToCreate = [];

			for (const tagName of extractedTags) {
				try {
					const existingTag = await this.tagService.findOneByOptions({
						where: {
							name: tagName,
							...(tenantId && { tenantId }),
							...(organizationId && { organizationId })
						}
					});
					if (existingTag) {
						existingTags.push(existingTag);
					} else {
						tagsToCreate.push(tagName);
					}
				} catch (error) {
					// Tag doesn't exist, add to create list
					tagsToCreate.push(tagName);
				}
			}

			// Create missing tags if requested
			const createdTags = [];
			if (createMissingTags && tagsToCreate.length > 0) {
				for (const tagName of tagsToCreate) {
					try {
						const newTag = await this.tagService.create({
							name: tagName,
							description: `Auto-generated tag for ${tagName}`,
							color: this.generateTagColor(tagName),
							...(tenantId && { tenantId }),
							...(organizationId && { organizationId })
						});
						createdTags.push(newTag);
						this.logger.debug(`Created new tag: ${tagName}`);
					} catch (error) {
						this.logger.warn(`Failed to create tag '${tagName}': ${error.message}`);
					}
				}
			}

			// Get all tags (existing + newly created)
			const allTags = [...existingTags, ...createdTags];
			const tagIds = allTags.map((tag) => tag.id);

			// Use bulk create command for plugin-tag relationships
			const result = await this.commandBus.execute(
				new BulkCreatePluginTagsCommand({
					pluginId,
					tagIds,
					...(tenantId && { tenantId }),
					...(organizationId && { organizationId })
				})
			);

			this.logger.log(`Auto-tagging completed for plugin ${pluginId}: ${result.created} relationships created`);

			return result;
		} catch (error) {
			this.logger.error(`Auto-tagging failed for plugin ${command.pluginId}: ${error.message}`, error.stack);

			if (error instanceof BadRequestException) {
				throw error;
			}

			throw new BadRequestException(`Auto-tagging failed: ${error.message}`);
		}
	}

	/**
	 * Extract potential tag names from plugin data
	 *
	 * @param pluginData - Plugin data to extract tags from
	 * @returns string[]
	 */
	private extractTagsFromPluginData(pluginData: any): string[] {
		const tags: Set<string> = new Set();

		// Add type-based tags
		if (pluginData.type) {
			tags.add(pluginData.type.toLowerCase());

			// Add specific type-based tags
			switch (pluginData.type.toLowerCase()) {
				case 'desktop':
					tags.add('desktop-app');
					break;
				case 'web':
					tags.add('web-app');
					tags.add('browser');
					break;
				case 'mobile':
					tags.add('mobile-app');
					break;
			}
		}

		// Add category-based tags
		if (pluginData.category) {
			tags.add(pluginData.category.toLowerCase().replace(/\s+/g, '-'));
		}

		// Add technology tags from keywords
		if (pluginData.keywords && Array.isArray(pluginData.keywords)) {
			pluginData.keywords.forEach((keyword: string) => {
				if (keyword && typeof keyword === 'string') {
					tags.add(keyword.toLowerCase().trim().replace(/\s+/g, '-'));
				}
			});
		}

		// Add technology tags
		if (pluginData.technologies && Array.isArray(pluginData.technologies)) {
			pluginData.technologies.forEach((tech: string) => {
				if (tech && typeof tech === 'string') {
					tags.add(tech.toLowerCase().trim().replace(/\s+/g, '-'));
				}
			});
		}

		// Extract tags from name
		if (pluginData.name) {
			const nameBasedTags = this.extractTagsFromText(pluginData.name);
			nameBasedTags.forEach((tag) => tags.add(tag));
		}

		// Extract tags from description
		if (pluginData.description) {
			const descriptionBasedTags = this.extractTagsFromText(pluginData.description);
			// Only add first few tags from description to avoid noise
			Array.from(descriptionBasedTags)
				.slice(0, 3)
				.forEach((tag) => tags.add(tag));
		}

		// Filter out common words and invalid tags
		const filteredTags = Array.from(tags).filter((tag) => this.isValidTag(tag));

		this.logger.debug(`Extracted ${filteredTags.length} tags: ${filteredTags.join(', ')}`);

		return filteredTags;
	}

	/**
	 * Extract potential tags from text
	 *
	 * @param text - Text to extract tags from
	 * @returns Set<string>
	 */
	private extractTagsFromText(text: string): Set<string> {
		const tags: Set<string> = new Set();

		// Common technology keywords to look for
		const techKeywords = [
			'react',
			'angular',
			'vue',
			'node',
			'nodejs',
			'typescript',
			'javascript',
			'python',
			'java',
			'php',
			'ruby',
			'go',
			'rust',
			'c#',
			'docker',
			'kubernetes',
			'aws',
			'azure',
			'gcp',
			'mongodb',
			'postgresql',
			'mysql',
			'redis',
			'elasticsearch',
			'api',
			'rest',
			'graphql',
			'microservice',
			'serverless',
			'webhook',
			'oauth',
			'jwt',
			'ssl',
			'analytics',
			'dashboard',
			'reporting',
			'integration',
			'sync',
			'automation',
			'workflow',
			'notification',
			'email',
			'sms'
		];

		const words = text
			.toLowerCase()
			.replace(/[^\w\s-]/g, ' ')
			.split(/\s+/)
			.filter((word) => word.length >= 2);

		for (const word of words) {
			// Check if word is a known technology keyword
			if (techKeywords.includes(word)) {
				tags.add(word);
			}

			// Check if word contains technology keywords
			for (const keyword of techKeywords) {
				if (word.includes(keyword) && word.length <= keyword.length + 3) {
					tags.add(keyword);
				}
			}
		}

		return tags;
	}

	/**
	 * Check if a tag name is valid
	 *
	 * @param tag - Tag name to validate
	 * @returns boolean
	 */
	private isValidTag(tag: string): boolean {
		// Filter out common English words and very short/long tags
		const commonWords = [
			'the',
			'and',
			'for',
			'are',
			'but',
			'not',
			'you',
			'all',
			'can',
			'had',
			'her',
			'was',
			'one',
			'our',
			'out',
			'day',
			'get',
			'has',
			'him',
			'his',
			'how',
			'its',
			'new',
			'now',
			'old',
			'see',
			'two',
			'way',
			'who',
			'boy',
			'did',
			'end',
			'few',
			'got',
			'let',
			'man',
			'may',
			'put',
			'run',
			'say',
			'she',
			'too',
			'use',
			'with',
			'into',
			'from',
			'they',
			'have',
			'this',
			'will',
			'your',
			'what',
			'when',
			'make',
			'time',
			'very',
			'just',
			'here',
			'than',
			'like',
			'many',
			'some',
			'come',
			'could',
			'would',
			'should'
		];

		return (
			tag.length >= 2 &&
			tag.length <= 50 &&
			!commonWords.includes(tag.toLowerCase()) &&
			/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(tag)
		);
	}

	/**
	 * Generate a color for a tag based on its name
	 *
	 * @param tagName - Name of the tag
	 * @returns string - Hex color code
	 */
	private generateTagColor(tagName: string): string {
		// Simple hash function to generate consistent colors
		let hash = 0;
		for (let i = 0; i < tagName.length; i++) {
			const char = tagName.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}

		// Convert to positive number and generate HSL color
		const hue = Math.abs(hash) % 360;
		const saturation = 70; // Fixed saturation for consistency
		const lightness = 50; // Fixed lightness for readability

		// Convert HSL to hex
		const hslToHex = (h: number, s: number, l: number): string => {
			l /= 100;
			const a = (s * Math.min(l, 1 - l)) / 100;
			const f = (n: number) => {
				const k = (n + h / 30) % 12;
				const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
				return Math.round(255 * color)
					.toString(16)
					.padStart(2, '0');
			};
			return `#${f(0)}${f(8)}${f(4)}`;
		};

		return hslToHex(hue, saturation, lightness);
	}
}
