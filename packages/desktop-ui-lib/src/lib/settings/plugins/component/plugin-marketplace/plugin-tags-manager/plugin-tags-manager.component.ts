import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin, ITag } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { BehaviorSubject, Observable, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

interface IPluginTag extends ITag {
	isFeatured?: boolean;
	priority?: number;
	appliedAt?: Date;
	appliedById?: string;
	isCustom?: boolean;
	usageCount?: number;
	category?: string;
}

interface ITagSuggestion {
	tag: IPluginTag;
	relevanceScore: number;
	reason: string;
}

@UntilDestroy()
@Component({
	selector: 'lib-plugin-tags-manager',
	templateUrl: './plugin-tags-manager.component.html',
	styleUrls: ['./plugin-tags-manager.component.scss'],
	standalone: false
})
export class PluginTagsManagerComponent implements OnInit, OnDestroy {
	@Input() plugin: IPlugin;
	@Input() selectedTags: IPluginTag[] = [];
	@Input() canEdit: boolean = true;
	@Input() maxTags: number = 10;
	@Input() showSuggestions: boolean = true;
	@Input() showFeatured: boolean = true;

	@Output() tagsChanged = new EventEmitter<IPluginTag[]>();
	@Output() tagCreated = new EventEmitter<IPluginTag>();

	public tagForm: FormGroup;
	public isLoading$ = new BehaviorSubject<boolean>(false);
	public searchTerm$ = new BehaviorSubject<string>('');
	public availableTags: IPluginTag[] = [];
	public filteredTags: IPluginTag[] = [];
	public tagSuggestions: ITagSuggestion[] = [];
	public popularTags: IPluginTag[] = [];
	public recentTags: IPluginTag[] = [];
	public showCreateForm = false;
	public showTagDetails = false;
	public selectedTagForDetails: IPluginTag | null = null;

	// Tag categories for organization
	public tagCategories = [
		{ value: 'technology', label: 'Technology', icon: 'code-outline', color: '#407BFF' },
		{ value: 'feature', label: 'Feature', icon: 'star-outline', color: '#00D68F' },
		{ value: 'integration', label: 'Integration', icon: 'link-outline', color: '#FFAA00' },
		{ value: 'industry', label: 'Industry', icon: 'briefcase-outline', color: '#8B5CF6' },
		{ value: 'platform', label: 'Platform', icon: 'monitor-outline', color: '#F56565' },
		{ value: 'license', label: 'License', icon: 'shield-outline', color: '#38B2AC' },
		{ value: 'other', label: 'Other', icon: 'folder-outline', color: '#718096' }
	];

	constructor(
		private readonly formBuilder: FormBuilder,
		private readonly dialogService: NbDialogService
	) {
		this.initializeForm();
		this.loadAvailableTags();
		this.setupSearchSubscription();
	}

	ngOnInit(): void {
		this.loadTagSuggestions();
		this.loadPopularTags();
		this.loadRecentTags();
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy
	}

	private initializeForm(): void {
		this.tagForm = this.formBuilder.group({
			name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
			description: ['', [Validators.maxLength(200)]],
			color: ['#407BFF', [Validators.required]],
			category: ['other', [Validators.required]],
			isPrivate: [false]
		});
	}

	private loadAvailableTags(): void {
		// In a real implementation, this would load from the API
		this.availableTags = this.getMockTags();
		this.filteredTags = [...this.availableTags];
	}

	private getMockTags(): IPluginTag[] {
		return [
			{
				id: '1',
				name: 'analytics',
				description: 'Data analytics and reporting features',
				color: '#407BFF',
				category: 'feature',
				isFeatured: true,
				priority: 100,
				usageCount: 156
			},
			{
				id: '2',
				name: 'integration',
				description: 'Third-party service integrations',
				color: '#FFAA00',
				category: 'integration',
				isFeatured: true,
				priority: 95,
				usageCount: 142
			},
			{
				id: '3',
				name: 'automation',
				description: 'Task automation and workflows',
				color: '#00D68F',
				category: 'feature',
				isFeatured: true,
				priority: 90,
				usageCount: 128
			},
			{
				id: '4',
				name: 'dashboard',
				description: 'Dashboard and visualization',
				color: '#8B5CF6',
				category: 'feature',
				priority: 85,
				usageCount: 115
			},
			{
				id: '5',
				name: 'api',
				description: 'API integration capabilities',
				color: '#F56565',
				category: 'technology',
				priority: 80,
				usageCount: 98
			},
			{
				id: '6',
				name: 'real-time',
				description: 'Real-time data processing',
				color: '#38B2AC',
				category: 'technology',
				priority: 75,
				usageCount: 87
			},
			{
				id: '7',
				name: 'machine-learning',
				description: 'Machine learning and AI features',
				color: '#9F7AEA',
				category: 'technology',
				priority: 70,
				usageCount: 76
			},
			{
				id: '8',
				name: 'crm',
				description: 'Customer relationship management',
				color: '#ED8936',
				category: 'industry',
				priority: 65,
				usageCount: 65
			},
			{
				id: '9',
				name: 'mobile',
				description: 'Mobile platform support',
				color: '#4299E1',
				category: 'platform',
				priority: 60,
				usageCount: 54
			},
			{
				id: '10',
				name: 'security',
				description: 'Security and authentication features',
				color: '#E53E3E',
				category: 'feature',
				priority: 55,
				usageCount: 43
			}
		];
	}

	private setupSearchSubscription(): void {
		this.searchTerm$
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				switchMap(term => this.filterTags(term)),
				untilDestroyed(this)
			)
			.subscribe(filteredTags => {
				this.filteredTags = filteredTags;
			});
	}

	private filterTags(searchTerm: string): Observable<IPluginTag[]> {
		if (!searchTerm.trim()) {
			return of([...this.availableTags]);
		}

		const filtered = this.availableTags.filter(tag =>
			tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			tag.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			tag.category?.toLowerCase().includes(searchTerm.toLowerCase())
		);

		return of(filtered);
	}

	private loadTagSuggestions(): void {
		if (!this.showSuggestions || !this.plugin) return;

		// In a real implementation, this would use AI/ML to suggest relevant tags
		this.tagSuggestions = this.generateSmartSuggestions();
	}

	private generateSmartSuggestions(): ITagSuggestion[] {
		const suggestions: ITagSuggestion[] = [];
		const pluginName = this.plugin.name?.toLowerCase() || '';
		const pluginDescription = this.plugin.description?.toLowerCase() || '';
		const pluginText = `${pluginName} ${pluginDescription}`;

		// Keyword-based suggestions
		const keywordMappings = [
			{ keywords: ['analytic', 'report', 'chart', 'graph', 'dashboard'], tag: 'analytics', reason: 'Analytics features detected' },
			{ keywords: ['api', 'rest', 'graphql', 'webhook'], tag: 'api', reason: 'API integration detected' },
			{ keywords: ['automat', 'workflow', 'trigger'], tag: 'automation', reason: 'Automation features detected' },
			{ keywords: ['real-time', 'live', 'instant'], tag: 'real-time', reason: 'Real-time capabilities detected' },
			{ keywords: ['mobile', 'android', 'ios', 'app'], tag: 'mobile', reason: 'Mobile platform support detected' },
			{ keywords: ['security', 'auth', 'encrypt', 'secure'], tag: 'security', reason: 'Security features detected' },
			{ keywords: ['machine learning', 'ai', 'artificial intelligence', 'ml'], tag: 'machine-learning', reason: 'AI/ML features detected' },
			{ keywords: ['crm', 'customer', 'sales', 'lead'], tag: 'crm', reason: 'CRM functionality detected' }
		];

		keywordMappings.forEach(mapping => {
			const hasKeyword = mapping.keywords.some(keyword => pluginText.includes(keyword));
			if (hasKeyword) {
				const tag = this.availableTags.find(t => t.name === mapping.tag);
				if (tag && !this.isTagSelected(tag)) {
					suggestions.push({
						tag,
						relevanceScore: 0.8,
						reason: mapping.reason
					});
				}
			}
		});

		// Category-based suggestions
		if (this.plugin.type) {
			const typeBasedTags = this.getTagsByPluginType(this.plugin.type);
			typeBasedTags.forEach(tag => {
				if (!this.isTagSelected(tag) && !suggestions.find(s => s.tag.id === tag.id)) {
					suggestions.push({
						tag,
						relevanceScore: 0.6,
						reason: `Recommended for ${this.plugin.type} plugins`
					});
				}
			});
		}

		return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
	}

	private getTagsByPluginType(pluginType: string): IPluginTag[] {
		const typeMappings: { [key: string]: string[] } = {
			'DESKTOP': ['desktop', 'native', 'electron'],
			'WEB': ['web', 'browser', 'javascript'],
			'MOBILE': ['mobile', 'android', 'ios']
		};

		const tagNames = typeMappings[pluginType] || [];
		return this.availableTags.filter(tag => tagNames.includes(tag.name));
	}

	private loadPopularTags(): void {
		this.popularTags = this.availableTags
			.filter(tag => tag.usageCount && tag.usageCount > 50)
			.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
			.slice(0, 8);
	}

	private loadRecentTags(): void {
		// In a real implementation, this would load recently used tags by the user
		this.recentTags = this.availableTags
			.filter(tag => tag.appliedAt)
			.sort((a, b) => (b.appliedAt?.getTime() || 0) - (a.appliedAt?.getTime() || 0))
			.slice(0, 6);
	}

	public isTagSelected(tag: IPluginTag): boolean {
		return this.selectedTags.some(selectedTag => selectedTag.id === tag.id);
	}

	public canAddMoreTags(): boolean {
		return this.selectedTags.length < this.maxTags;
	}

	public selectTag(tag: IPluginTag): void {
		if (!this.canEdit || this.isTagSelected(tag) || !this.canAddMoreTags()) {
			return;
		}

		const updatedTags = [...this.selectedTags, tag];
		this.selectedTags = updatedTags;
		this.tagsChanged.emit(updatedTags);
	}

	public removeTag(tag: IPluginTag): void {
		if (!this.canEdit) return;

		const updatedTags = this.selectedTags.filter(selectedTag => selectedTag.id !== tag.id);
		this.selectedTags = updatedTags;
		this.tagsChanged.emit(updatedTags);
	}

	public toggleTagFeatured(tag: IPluginTag): void {
		if (!this.canEdit) return;

		const tagIndex = this.selectedTags.findIndex(t => t.id === tag.id);
		if (tagIndex >= 0) {
			this.selectedTags[tagIndex] = {
				...this.selectedTags[tagIndex],
				isFeatured: !this.selectedTags[tagIndex].isFeatured
			};
			this.tagsChanged.emit([...this.selectedTags]);
		}
	}

	public setTagPriority(tag: IPluginTag, priority: number): void {
		if (!this.canEdit) return;

		const tagIndex = this.selectedTags.findIndex(t => t.id === tag.id);
		if (tagIndex >= 0) {
			this.selectedTags[tagIndex] = {
				...this.selectedTags[tagIndex],
				priority: Math.max(0, Math.min(100, priority))
			};
			this.tagsChanged.emit([...this.selectedTags]);
		}
	}

	public openCreateTagForm(): void {
		this.showCreateForm = true;
		this.tagForm.reset({
			name: '',
			description: '',
			color: '#407BFF',
			category: 'other',
			isPrivate: false
		});
	}

	public createTag(): void {
		if (!this.tagForm.valid) return;

		const formValue = this.tagForm.value;
		const newTag: IPluginTag = {
			id: Date.now().toString(), // In real app, this would be generated by backend
			name: formValue.name.toLowerCase().replace(/\s+/g, '-'),
			description: formValue.description,
			color: formValue.color,
			category: formValue.category,
			isCustom: true,
			priority: 50,
			appliedAt: new Date(),
			usageCount: 0
		};

		// Add to available tags
		this.availableTags.unshift(newTag);
		this.filteredTags.unshift(newTag);

		// Auto-select the new tag
		if (this.canAddMoreTags()) {
			this.selectTag(newTag);
		}

		this.tagCreated.emit(newTag);
		this.showCreateForm = false;
		this.tagForm.reset();
	}

	public cancelCreateTag(): void {
		this.showCreateForm = false;
		this.tagForm.reset();
	}

	public showTagDetailsDialog(tag: IPluginTag): void {
		this.selectedTagForDetails = tag;
		this.showTagDetails = true;
	}

	public closeTagDetails(): void {
		this.showTagDetails = false;
		this.selectedTagForDetails = null;
	}

	public getCategoryInfo(categoryValue: string) {
		return this.tagCategories.find(cat => cat.value === categoryValue) || this.tagCategories[6];
	}

	public getSelectedTagsSorted(): IPluginTag[] {
		return [...this.selectedTags].sort((a, b) => {
			// Featured tags first
			if (a.isFeatured && !b.isFeatured) return -1;
			if (!a.isFeatured && b.isFeatured) return 1;

			// Then by priority (higher first)
			const priorityA = a.priority || 0;
			const priorityB = b.priority || 0;
			if (priorityA !== priorityB) return priorityB - priorityA;

			// Finally by name
			return a.name.localeCompare(b.name);
		});
	}

	public onTagRemove(tagToRemove: string): void {
		const tag = this.selectedTags.find(t => t.name === tagToRemove);
		if (tag) {
			this.removeTag(tag);
		}
	}

	public clearAllTags(): void {
		if (!this.canEdit) return;

		this.selectedTags = [];
		this.tagsChanged.emit([]);
	}

	public applySuggestedTag(suggestion: ITagSuggestion): void {
		this.selectTag(suggestion.tag);
	}

	public dismissSuggestion(suggestion: ITagSuggestion): void {
		this.tagSuggestions = this.tagSuggestions.filter(s => s.tag.id !== suggestion.tag.id);
	}

	public getTagUsageText(tag: IPluginTag): string {
		const count = tag.usageCount || 0;
		if (count === 0) return 'New tag';
		if (count === 1) return '1 plugin';
		return `${count} plugins`;
	}
}
