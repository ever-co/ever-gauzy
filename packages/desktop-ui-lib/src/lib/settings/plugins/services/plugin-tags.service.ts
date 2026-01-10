import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination, ITag } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { BehaviorSubject, map, Observable, shareReplay, tap } from 'rxjs';

// Plugin-specific tag interfaces
export interface IPluginTag extends ITag {
	isFeatured?: boolean;
	priority?: number;
	appliedAt?: Date;
	appliedById?: string;
	isCustom?: boolean;
	usageCount?: number;
	category?: string;
	pluginIds?: string[];
}

export interface ITagSuggestion {
	tag: IPluginTag;
	relevanceScore: number;
	reason: string;
}

export interface IPluginTagCreateInput {
	name: string;
	description?: string;
	color?: string;
	category?: string;
	isPrivate?: boolean;
	isFeatured?: boolean;
	priority?: number;
}

export interface IPluginTagUpdateInput extends Partial<IPluginTagCreateInput> {
	id: string;
}

export interface IPluginTagAssignmentInput {
	pluginId: string;
	tagIds: string[];
	priority?: number;
	isFeatured?: boolean;
}

export enum PluginTagCategory {
	TECHNICAL = 'technical',
	BUSINESS = 'business',
	UI_UX = 'ui-ux',
	INTEGRATION = 'integration',
	PRODUCTIVITY = 'productivity',
	ANALYTICS = 'analytics',
	SECURITY = 'security',
	AUTOMATION = 'automation',
	COMMUNICATION = 'communication',
	OTHER = 'other'
}

@Injectable({
	providedIn: 'root'
})
export class PluginTagsService {
	private readonly endPoint = `${API_PREFIX}/plugin-tags`;
	private readonly tagsCache$ = new BehaviorSubject<IPluginTag[]>([]);
	private readonly popularTagsCache$ = new BehaviorSubject<IPluginTag[]>([]);
	private readonly recentTagsCache$ = new BehaviorSubject<IPluginTag[]>([]);

	constructor(private readonly http: HttpClient) {}

	// Tag CRUD Operations
	public getAllTags<T>(params = {} as T): Observable<IPagination<IPluginTag>> {
		return this.http
			.get<IPagination<IPluginTag>>(this.endPoint, {
				params: toParams(params)
			})
			.pipe(
				tap((response) => {
					this.tagsCache$.next(response.items);
				}),
				shareReplay(1)
			);
	}

	public getTag(id: string): Observable<IPluginTag> {
		return this.http.get<IPluginTag>(`${this.endPoint}/${id}`);
	}

	public createTag(tag: IPluginTagCreateInput): Observable<IPluginTag> {
		return this.http.post<IPluginTag>(this.endPoint, tag).pipe(
			tap((newTag) => {
				const currentTags = this.tagsCache$.value;
				this.tagsCache$.next([newTag, ...currentTags]);
			})
		);
	}

	public updateTag(id: string, tag: IPluginTagUpdateInput): Observable<IPluginTag> {
		return this.http.put<IPluginTag>(`${this.endPoint}/${id}`, tag).pipe(
			tap((updatedTag) => {
				const currentTags = this.tagsCache$.value;
				const updatedTags = currentTags.map((t) => (t.id === id ? updatedTag : t));
				this.tagsCache$.next(updatedTags);
			})
		);
	}

	public deleteTag(id: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${id}`).pipe(
			tap(() => {
				const currentTags = this.tagsCache$.value;
				const filteredTags = currentTags.filter((t) => t.id !== id);
				this.tagsCache$.next(filteredTags);
			})
		);
	}

	// Plugin Tag Assignment Operations
	public assignTagsToPlugin(assignment: IPluginTagAssignmentInput): Observable<void> {
		return this.http.post<void>(`${this.endPoint}/assign`, assignment);
	}

	public removeTagsFromPlugin(pluginId: string, tagIds: string[]): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/assign`, {
			body: { pluginId, tagIds }
		});
	}

	public getPluginTags(pluginId: string): Observable<IPluginTag[]> {
		return this.http.get<IPluginTag[]>(`${this.endPoint}/plugin/${pluginId}`);
	}

	public updatePluginTagPriority(pluginId: string, tagId: string, priority: number): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/plugin/${pluginId}/tag/${tagId}`, {
			priority
		});
	}

	public togglePluginTagFeatured(pluginId: string, tagId: string, isFeatured: boolean): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/plugin/${pluginId}/tag/${tagId}`, {
			isFeatured
		});
	}

	// Tag Discovery and Suggestions
	public getPopularTags(limit: number = 20): Observable<IPluginTag[]> {
		return this.http
			.get<IPluginTag[]>(`${this.endPoint}/popular`, {
				params: toParams({ limit })
			})
			.pipe(
				tap((tags) => {
					this.popularTagsCache$.next(tags);
				}),
				shareReplay(1)
			);
	}

	public getRecentTags(limit: number = 10): Observable<IPluginTag[]> {
		return this.http
			.get<IPluginTag[]>(`${this.endPoint}/recent`, {
				params: toParams({ limit })
			})
			.pipe(
				tap((tags) => {
					this.recentTagsCache$.next(tags);
				}),
				shareReplay(1)
			);
	}

	public getTagSuggestions(pluginId: string): Observable<ITagSuggestion[]> {
		return this.http.get<ITagSuggestion[]>(`${this.endPoint}/suggestions/${pluginId}`);
	}

	public searchTags(query: string, limit: number = 50): Observable<IPluginTag[]> {
		return this.http.get<IPluginTag[]>(`${this.endPoint}/search`, {
			params: toParams({ query, limit })
		});
	}

	// Tag Categories
	public getTagsByCategory(category: PluginTagCategory): Observable<IPluginTag[]> {
		return this.http.get<IPluginTag[]>(`${this.endPoint}/category/${category}`);
	}

	public getTagCategories(): Observable<{ category: PluginTagCategory; count: number; tags: IPluginTag[] }[]> {
		return this.http.get<{ category: PluginTagCategory; count: number; tags: IPluginTag[] }[]>(
			`${this.endPoint}/categories`
		);
	}

	// Tag Analytics
	public getTagUsageAnalytics(tagId: string): Observable<{
		totalUsage: number;
		weeklyUsage: number;
		monthlyUsage: number;
		topPlugins: Array<{ pluginId: string; pluginName: string; usageCount: number }>;
	}> {
		return this.http.get<{
			totalUsage: number;
			weeklyUsage: number;
			monthlyUsage: number;
			topPlugins: Array<{ pluginId: string; pluginName: string; usageCount: number }>;
		}>(`${this.endPoint}/${tagId}/analytics`);
	}

	public getPluginTagAnalytics(pluginId: string): Observable<{
		totalTags: number;
		featuredTags: number;
		categoryCounts: Record<PluginTagCategory, number>;
		popularTags: IPluginTag[];
	}> {
		return this.http.get<{
			totalTags: number;
			featuredTags: number;
			categoryCounts: Record<PluginTagCategory, number>;
			popularTags: IPluginTag[];
		}>(`${this.endPoint}/plugin/${pluginId}/analytics`);
	}

	// Bulk Operations
	public bulkCreateTags(tags: IPluginTagCreateInput[]): Observable<IPluginTag[]> {
		return this.http.post<IPluginTag[]>(`${this.endPoint}/bulk`, { tags }).pipe(
			tap((newTags) => {
				const currentTags = this.tagsCache$.value;
				this.tagsCache$.next([...newTags, ...currentTags]);
			})
		);
	}

	public bulkUpdateTags(updates: IPluginTagUpdateInput[]): Observable<IPluginTag[]> {
		return this.http.put<IPluginTag[]>(`${this.endPoint}/bulk`, { updates }).pipe(
			tap((updatedTags) => {
				const currentTags = this.tagsCache$.value;
				const updatedTagsMap = new Map(updatedTags.map((tag) => [tag.id, tag]));
				const newTags = currentTags.map((tag) => updatedTagsMap.get(tag.id) || tag);
				this.tagsCache$.next(newTags);
			})
		);
	}

	public bulkDeleteTags(tagIds: string[]): Observable<void> {
		return this.http
			.delete<void>(`${this.endPoint}/bulk`, {
				body: { tagIds }
			})
			.pipe(
				tap(() => {
					const currentTags = this.tagsCache$.value;
					const filteredTags = currentTags.filter((tag) => !tagIds.includes(tag.id));
					this.tagsCache$.next(filteredTags);
				})
			);
	}

	// Tag Import/Export
	public exportTags(pluginId?: string): Observable<Blob> {
		const params = pluginId ? { pluginId } : {};
		return this.http.get(`${this.endPoint}/export`, {
			params: toParams(params),
			responseType: 'blob'
		});
	}

	public importTags(
		file: File,
		pluginId?: string
	): Observable<{
		imported: number;
		skipped: number;
		errors: string[];
	}> {
		const formData = new FormData();
		formData.append('file', file);
		if (pluginId) {
			formData.append('pluginId', pluginId);
		}

		return this.http.post<{
			imported: number;
			skipped: number;
			errors: string[];
		}>(`${this.endPoint}/import`, formData);
	}

	// Cache Management
	public refreshTagsCache(): Observable<IPluginTag[]> {
		return this.getAllTags().pipe(map((response) => response.items));
	}

	public getTagsFromCache(): Observable<IPluginTag[]> {
		return this.tagsCache$.asObservable();
	}

	public getPopularTagsFromCache(): Observable<IPluginTag[]> {
		return this.popularTagsCache$.asObservable();
	}

	public getRecentTagsFromCache(): Observable<IPluginTag[]> {
		return this.recentTagsCache$.asObservable();
	}

	public clearCache(): void {
		this.tagsCache$.next([]);
		this.popularTagsCache$.next([]);
		this.recentTagsCache$.next([]);
	}

	// Utility Methods
	public getCategoryInfo(category: PluginTagCategory): {
		label: string;
		icon: string;
		color: string;
		description: string;
	} {
		const categoryMap = {
			[PluginTagCategory.TECHNICAL]: {
				label: 'Technical',
				icon: 'code-outline',
				color: '#3366FF',
				description: 'Programming languages, frameworks, and technical tools'
			},
			[PluginTagCategory.BUSINESS]: {
				label: 'Business',
				icon: 'briefcase-outline',
				color: '#FF6B35',
				description: 'Business processes, management, and enterprise features'
			},
			[PluginTagCategory.UI_UX]: {
				label: 'UI/UX',
				icon: 'brush-outline',
				color: '#8B5CF6',
				description: 'User interface, design, and user experience'
			},
			[PluginTagCategory.INTEGRATION]: {
				label: 'Integration',
				icon: 'link-outline',
				color: '#10B981',
				description: 'Third-party integrations and API connections'
			},
			[PluginTagCategory.PRODUCTIVITY]: {
				label: 'Productivity',
				icon: 'trending-up-outline',
				color: '#F59E0B',
				description: 'Tools and features that enhance productivity'
			},
			[PluginTagCategory.ANALYTICS]: {
				label: 'Analytics',
				icon: 'pie-chart-outline',
				color: '#EF4444',
				description: 'Data analysis, reporting, and metrics'
			},
			[PluginTagCategory.SECURITY]: {
				label: 'Security',
				icon: 'shield-outline',
				color: '#DC2626',
				description: 'Security features, authentication, and protection'
			},
			[PluginTagCategory.AUTOMATION]: {
				label: 'Automation',
				icon: 'flash-outline',
				color: '#7C3AED',
				description: 'Workflow automation and task scheduling'
			},
			[PluginTagCategory.COMMUNICATION]: {
				label: 'Communication',
				icon: 'people-outline',
				color: '#06B6D4',
				description: 'Messaging, collaboration, and communication tools'
			},
			[PluginTagCategory.OTHER]: {
				label: 'Other',
				icon: 'cube-outline',
				color: '#6B7280',
				description: 'Miscellaneous features and utilities'
			}
		};

		return categoryMap[category] || categoryMap[PluginTagCategory.OTHER];
	}

	public validateTagName(name: string): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (!name || name.trim().length === 0) {
			errors.push('Tag name is required');
		}

		if (name.length < 2) {
			errors.push('Tag name must be at least 2 characters');
		}

		if (name.length > 30) {
			errors.push('Tag name cannot exceed 30 characters');
		}

		if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
			errors.push('Tag name can only contain letters, numbers, spaces, hyphens, and underscores');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	public formatTagForDisplay(tag: IPluginTag): string {
		return tag.name.charAt(0).toUpperCase() + tag.name.slice(1).toLowerCase();
	}

	public generateTagColor(): string {
		const colors = [
			'#3366FF',
			'#FF6B35',
			'#8B5CF6',
			'#10B981',
			'#F59E0B',
			'#EF4444',
			'#DC2626',
			'#7C3AED',
			'#06B6D4',
			'#6B7280',
			'#F97316',
			'#84CC16',
			'#22D3EE',
			'#A855F7',
			'#EC4899'
		];
		return colors[Math.floor(Math.random() * colors.length)];
	}
}
