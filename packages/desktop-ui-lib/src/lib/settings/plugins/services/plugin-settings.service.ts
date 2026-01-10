import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { map, Observable, shareReplay } from 'rxjs';

// Plugin settings interfaces
export interface IPluginSetting {
	id: string;
	pluginId: string;
	key: string;
	value: any;
	type: PluginSettingType;
	label: string;
	description?: string;
	category?: string;
	isRequired: boolean;
	isEncrypted: boolean;
	isVisible: boolean;
	defaultValue?: any;
	validation?: IPluginSettingValidation;
	options?: IPluginSettingOption[];
	metadata?: Record<string, any>;
	tenantId?: string;
	organizationId?: string;
	userId?: string;
	scope: PluginSettingScope;
	createdAt: Date;
	updatedAt: Date;
}

export interface IPluginSettingTemplate {
	id: string;
	pluginId: string;
	key: string;
	type: PluginSettingType;
	label: string;
	description?: string;
	category?: string;
	isRequired: boolean;
	isEncrypted: boolean;
	isVisible: boolean;
	defaultValue?: any;
	validation?: IPluginSettingValidation;
	options?: IPluginSettingOption[];
	order: number;
	scope: PluginSettingScope;
	metadata?: Record<string, any>;
}

export interface IPluginSettingValidation {
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	pattern?: string;
	customValidator?: string;
	errorMessage?: string;
}

export interface IPluginSettingOption {
	value: any;
	label: string;
	description?: string;
	icon?: string;
	disabled?: boolean;
}

export interface IPluginSettingGroup {
	category: string;
	label: string;
	description?: string;
	icon?: string;
	order: number;
	settings: IPluginSetting[];
}

export enum PluginSettingType {
	STRING = 'string',
	NUMBER = 'number',
	BOOLEAN = 'boolean',
	JSON = 'json',
	PASSWORD = 'password',
	EMAIL = 'email',
	URL = 'url',
	TEXT = 'text',
	SELECT = 'select',
	MULTI_SELECT = 'multi_select',
	RADIO = 'radio',
	CHECKBOX = 'checkbox',
	DATE = 'date',
	TIME = 'time',
	DATETIME = 'datetime',
	FILE = 'file',
	IMAGE = 'image',
	COLOR = 'color',
	RANGE = 'range'
}

export enum PluginSettingScope {
	GLOBAL = 'global',
	TENANT = 'tenant',
	ORGANIZATION = 'organization',
	USER = 'user',
	PLUGIN = 'plugin'
}

// Input interfaces
export interface IPluginSettingCreateInput {
	pluginId: string;
	key: string;
	value: any;
	type: PluginSettingType;
	label: string;
	description?: string;
	categoryId?: string;
	isRequired?: boolean;
	isEncrypted?: boolean;
	isVisible?: boolean;
	validation?: IPluginSettingValidation;
	options?: IPluginSettingOption[];
	scope: PluginSettingScope;
	tenantId?: string;
	organizationId?: string;
	userId?: string;
	metadata?: Record<string, any>;
}

export interface IPluginSettingUpdateInput {
	value?: any;
	label?: string;
	description?: string;
	category?: string;
	isRequired?: boolean;
	isEncrypted?: boolean;
	isVisible?: boolean;
	validation?: IPluginSettingValidation;
	options?: IPluginSettingOption[];
	metadata?: Record<string, any>;
}

export interface IPluginSettingTemplateCreateInput {
	pluginId: string;
	key: string;
	type: PluginSettingType;
	label: string;
	description?: string;
	category?: string;
	isRequired?: boolean;
	isEncrypted?: boolean;
	isVisible?: boolean;
	defaultValue?: any;
	validation?: IPluginSettingValidation;
	options?: IPluginSettingOption[];
	order?: number;
	scope: PluginSettingScope;
	metadata?: Record<string, any>;
}

export interface IPluginSettingsBulkUpdateInput {
	settings: Array<{
		key: string;
		value: any;
	}>;
	scope?: PluginSettingScope;
	tenantId?: string;
	organizationId?: string;
	userId?: string;
}

export interface CreatePluginSettingDTO {
	key: string;
	value: any;
	type: PluginSettingType;
	label: string;
	description?: string;
	category?: string;
	isRequired?: boolean;
	isEncrypted?: boolean;
	isVisible?: boolean;
	validation?: IPluginSettingValidation;
	options?: IPluginSettingOption[];
	scope: PluginSettingScope;
	organizationId?: string;
	metadata?: Record<string, any>;
}

export interface BulkUpdatePluginSettingsDTO {
	pluginId?: string;
	settings: Array<{
		key: string;
		value: any;
		[key: string]: any;
	}>;
	pluginTenantId?: string;
}

export interface PluginSettingQueryDTO {
	category?: string;
	key?: string;
	pluginTenantId?: string;
}

@Injectable({
	providedIn: 'root'
})
export class PluginSettingsService {
	private readonly endPoint = `${API_PREFIX}/plugins`;

	constructor(private readonly http: HttpClient) {}

	// Plugin Settings CRUD Operations
	public createPluginSetting(pluginId: string, setting: IPluginSetting): Observable<IPluginSetting> {
		return this.http.post<IPluginSetting>(`${this.endPoint}/${pluginId}/settings`, setting).pipe();
	}

	public getPluginSettings(pluginId: string, query?: PluginSettingQueryDTO): Observable<IPluginSetting[]> {
		let params = new HttpParams();
		if (query?.category) {
			params = params.set('category', query.category);
		}
		if (query?.key) {
			params = params.set('key', query.key);
		}
		if (query?.pluginTenantId) {
			params = params.set('pluginTenantId', query.pluginTenantId);
		}

		return this.http
			.get<IPluginSetting[]>(`${this.endPoint}/${pluginId}/settings`, { params })
			.pipe(shareReplay(1));
	}

	public getPluginSettingById(pluginId: string, id: string): Observable<IPluginSetting> {
		return this.http.get<IPluginSetting>(`${this.endPoint}/${pluginId}/settings/${id}`);
	}

	public getPluginSettingsGrouped(
		pluginId: string,
		query?: PluginSettingQueryDTO
	): Observable<IPluginSettingGroup[]> {
		return this.getPluginSettings(pluginId, query).pipe(map((settings) => this.groupSettingsByCategory(settings)));
	}

	public getSettingValue(pluginId: string, key: string, pluginTenantId?: string): Observable<any> {
		let params = new HttpParams().set('key', key);
		if (pluginTenantId) {
			params = params.set('pluginTenantId', pluginTenantId);
		}

		return this.http
			.get<IPluginSetting>(`${this.endPoint}/${pluginId}/settings`, { params })
			.pipe(map((setting) => setting?.value));
	}

	public createSetting(setting: IPluginSettingCreateInput): Observable<IPluginSetting> {
		const { pluginId, ...settingData } = setting;
		return this.http.post<IPluginSetting>(`${this.endPoint}/${pluginId}/settings`, settingData);
	}

	public updateSetting(id: string, setting: IPluginSettingUpdateInput): Observable<IPluginSetting> {
		return this.http.put<IPluginSetting>(`${this.endPoint}/${id}`, setting);
	}

	public setSettingValue(
		pluginId: string,
		key: string,
		value: any,
		scope?: PluginSettingScope,
		tenantId?: string,
		organizationId?: string,
		userId?: string
	): Observable<IPluginSetting> {
		const params: any = { key, value };
		if (scope) params.scope = scope;
		if (tenantId) params.tenantId = tenantId;
		if (organizationId) params.organizationId = organizationId;
		if (userId) params.userId = userId;

		return this.http.post<IPluginSetting>(`${this.endPoint}/plugin/${pluginId}/value`, params);
	}

	public deleteSetting(pluginId: string, settingId: string): Observable<{ deleted: boolean; id: string }> {
		return this.http.delete<{ deleted: boolean; id: string }>(`${this.endPoint}/${pluginId}/settings/${settingId}`);
	}

	// Bulk Operations
	public bulkUpdatePluginSettings(
		pluginId: string,
		bulkUpdateDto: BulkUpdatePluginSettingsDTO
	): Observable<IPluginSetting[]> {
		return this.http.patch<IPluginSetting[]>(`${this.endPoint}/${pluginId}/settings`, bulkUpdateDto);
	}

	public updateAndValidatePluginSetting(
		pluginId: string,
		id: string,
		updateData: { value: any; [key: string]: any }
	): Observable<{ setting: IPluginSetting; validation: { valid: boolean; errors?: string[] } }> {
		return this.http.put<{ setting: IPluginSetting; validation: { valid: boolean; errors?: string[] } }>(
			`${this.endPoint}/${pluginId}/settings/${id}`,
			updateData
		);
	}

	public resetSettingsToDefault(
		pluginId: string,
		scope?: PluginSettingScope,
		tenantId?: string,
		organizationId?: string,
		userId?: string
	): Observable<IPluginSetting[]> {
		const params: any = {};
		if (scope) params.scope = scope;
		if (tenantId) params.tenantId = tenantId;
		if (organizationId) params.organizationId = organizationId;
		if (userId) params.userId = userId;

		return this.http.post<IPluginSetting[]>(`${this.endPoint}/plugin/${pluginId}/reset`, params);
	}

	// Setting Templates
	public getPluginSettingTemplates(pluginId: string): Observable<IPluginSettingTemplate[]> {
		return this.http.get<IPluginSettingTemplate[]>(`${this.endPoint}/${pluginId}/templates`);
	}

	public createSettingTemplate(template: IPluginSettingTemplateCreateInput): Observable<IPluginSettingTemplate> {
		return this.http.post<IPluginSettingTemplate>(`${this.endPoint}/${template.pluginId}/templates`, template);
	}

	public updateSettingTemplate(
		pluginId: string,
		id: string,
		template: Partial<IPluginSettingTemplateCreateInput>
	): Observable<IPluginSettingTemplate> {
		return this.http.put<IPluginSettingTemplate>(`${this.endPoint}/${pluginId}/templates/${id}`, template);
	}

	public deleteSettingTemplate(pluginId: string, id: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${pluginId}/templates/${id}`);
	}

	// Import/Export
	public exportSettings(
		pluginId: string,
		scope?: PluginSettingScope,
		tenantId?: string,
		organizationId?: string,
		userId?: string
	): Observable<Blob> {
		const params: any = {};
		if (scope) params.scope = scope;
		if (tenantId) params.tenantId = tenantId;
		if (organizationId) params.organizationId = organizationId;
		if (userId) params.userId = userId;

		return this.http.get(`${this.endPoint}/plugin/${pluginId}/export`, {
			params: toParams(params),
			responseType: 'blob'
		});
	}

	public importSettings(
		pluginId: string,
		file: File,
		scope?: PluginSettingScope,
		tenantId?: string,
		organizationId?: string,
		userId?: string
	): Observable<{
		imported: number;
		skipped: number;
		errors: string[];
	}> {
		const formData = new FormData();
		formData.append('file', file);
		if (scope) formData.append('scope', scope);
		if (tenantId) formData.append('tenantId', tenantId);
		if (organizationId) formData.append('organizationId', organizationId);
		if (userId) formData.append('userId', userId);

		return this.http.post<{
			imported: number;
			skipped: number;
			errors: string[];
		}>(`${this.endPoint}/plugin/${pluginId}/import`, formData);
	}

	// Validation
	public validateSetting(
		pluginId: string,
		key: string,
		value: any,
		template?: IPluginSettingTemplate
	): Observable<{
		valid: boolean;
		errors: string[];
	}> {
		return this.http.post<{
			valid: boolean;
			errors: string[];
		}>(`${this.endPoint}/plugin/${pluginId}/validate`, {
			key,
			value,
			template
		});
	}

	public validateSettingsSchema(
		pluginId: string,
		settings: Record<string, any>
	): Observable<{
		valid: boolean;
		errors: Array<{ key: string; errors: string[] }>;
	}> {
		return this.http.post<{
			valid: boolean;
			errors: Array<{ key: string; errors: string[] }>;
		}>(`${this.endPoint}/plugin/${pluginId}/validate-schema`, { settings });
	}

	// Utility Methods
	public groupSettingsByCategory(settings: IPluginSetting[]): IPluginSettingGroup[] {
		const groups = new Map<string, IPluginSettingGroup>();

		settings.forEach((setting) => {
			const category = setting.category || 'General';

			if (!groups.has(category)) {
				groups.set(category, {
					category,
					label: this.formatCategoryLabel(category),
					description: this.getCategoryDescription(category),
					icon: this.getCategoryIcon(category),
					order: this.getCategoryOrder(category),
					settings: []
				});
			}

			groups.get(category)!.settings.push(setting);
		});

		return Array.from(groups.values()).sort((a, b) => a.order - b.order);
	}

	public validateSettingValue(
		value: any,
		type: PluginSettingType,
		validation?: IPluginSettingValidation
	): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Required validation
		if (validation?.required && (value === null || value === undefined || value === '')) {
			errors.push('This field is required');
		}

		if (value !== null && value !== undefined && value !== '') {
			// Type-specific validation
			switch (type) {
				case PluginSettingType.STRING:
				case PluginSettingType.TEXT:
				case PluginSettingType.PASSWORD:
					this.validateStringValue(value, validation, errors);
					break;
				case PluginSettingType.NUMBER:
				case PluginSettingType.RANGE:
					this.validateNumberValue(value, validation, errors);
					break;
				case PluginSettingType.EMAIL:
					this.validateEmailValue(value, errors);
					break;
				case PluginSettingType.URL:
					this.validateUrlValue(value, errors);
					break;
				case PluginSettingType.JSON:
					this.validateJsonValue(value, errors);
					break;
				case PluginSettingType.DATE:
				case PluginSettingType.TIME:
				case PluginSettingType.DATETIME:
					this.validateDateValue(value, errors);
					break;
			}

			// Pattern validation
			if (validation?.pattern) {
				const regex = new RegExp(validation.pattern);
				if (!regex.test(String(value))) {
					errors.push(validation.errorMessage || 'Value does not match the required pattern');
				}
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	private validateStringValue(value: any, validation?: IPluginSettingValidation, errors: string[] = []): void {
		const strValue = String(value);

		if (validation?.minLength && strValue.length < validation.minLength) {
			errors.push(`Minimum length is ${validation.minLength} characters`);
		}

		if (validation?.maxLength && strValue.length > validation.maxLength) {
			errors.push(`Maximum length is ${validation.maxLength} characters`);
		}
	}

	private validateNumberValue(value: any, validation?: IPluginSettingValidation, errors: string[] = []): void {
		const numValue = Number(value);

		if (isNaN(numValue)) {
			errors.push('Must be a valid number');
			return;
		}

		if (validation?.min !== undefined && numValue < validation.min) {
			errors.push(`Minimum value is ${validation.min}`);
		}

		if (validation?.max !== undefined && numValue > validation.max) {
			errors.push(`Maximum value is ${validation.max}`);
		}
	}

	private validateEmailValue(value: any, errors: string[] = []): void {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(String(value))) {
			errors.push('Must be a valid email address');
		}
	}

	private validateUrlValue(value: any, errors: string[] = []): void {
		try {
			new URL(String(value));
		} catch {
			errors.push('Must be a valid URL');
		}
	}

	private validateJsonValue(value: any, errors: string[] = []): void {
		try {
			if (typeof value === 'string') {
				JSON.parse(value);
			}
		} catch {
			errors.push('Must be valid JSON');
		}
	}

	private validateDateValue(value: any, errors: string[] = []): void {
		const date = new Date(value);
		if (isNaN(date.getTime())) {
			errors.push('Must be a valid date');
		}
	}

	private formatCategoryLabel(category: string): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	private getCategoryDescription(category: string): string {
		const descriptions: Record<string, string> = {
			general: 'General plugin settings',
			security: 'Security and authentication settings',
			api: 'API configuration and endpoints',
			ui: 'User interface customization',
			notifications: 'Notification preferences',
			performance: 'Performance and optimization settings',
			integration: 'Third-party integrations',
			advanced: 'Advanced configuration options'
		};

		return descriptions[category.toLowerCase()] || 'Plugin settings';
	}

	private getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			general: 'settings-outline',
			security: 'shield-outline',
			api: 'code-outline',
			ui: 'brush-outline',
			notifications: 'bell-outline',
			performance: 'flash-outline',
			integration: 'link-outline',
			advanced: 'options-outline'
		};

		return icons[category.toLowerCase()] || 'settings-outline';
	}

	private getCategoryOrder(category: string): number {
		const orders: Record<string, number> = {
			general: 1,
			ui: 2,
			api: 3,
			integration: 4,
			notifications: 5,
			performance: 6,
			security: 7,
			advanced: 8
		};

		return orders[category.toLowerCase()] || 9;
	}

	public getSettingTypeIcon(type: PluginSettingType): string {
		const icons: Record<PluginSettingType, string> = {
			[PluginSettingType.STRING]: 'text-outline',
			[PluginSettingType.NUMBER]: 'hash-outline',
			[PluginSettingType.BOOLEAN]: 'checkmark-outline',
			[PluginSettingType.JSON]: 'code-outline',
			[PluginSettingType.PASSWORD]: 'lock-outline',
			[PluginSettingType.EMAIL]: 'email-outline',
			[PluginSettingType.URL]: 'link-outline',
			[PluginSettingType.TEXT]: 'file-text-outline',
			[PluginSettingType.SELECT]: 'list-outline',
			[PluginSettingType.MULTI_SELECT]: 'checkmark-square-outline',
			[PluginSettingType.RADIO]: 'radio-button-on-outline',
			[PluginSettingType.CHECKBOX]: 'checkmark-square-outline',
			[PluginSettingType.DATE]: 'calendar-outline',
			[PluginSettingType.TIME]: 'clock-outline',
			[PluginSettingType.DATETIME]: 'calendar-outline',
			[PluginSettingType.FILE]: 'attach-outline',
			[PluginSettingType.IMAGE]: 'image-outline',
			[PluginSettingType.COLOR]: 'color-palette-outline',
			[PluginSettingType.RANGE]: 'options-outline'
		};

		return icons[type] || 'settings-outline';
	}

	public formatSettingType(type: PluginSettingType): string {
		const typeMap: Record<PluginSettingType, string> = {
			[PluginSettingType.STRING]: 'Text',
			[PluginSettingType.NUMBER]: 'Number',
			[PluginSettingType.BOOLEAN]: 'Boolean',
			[PluginSettingType.JSON]: 'JSON',
			[PluginSettingType.PASSWORD]: 'Password',
			[PluginSettingType.EMAIL]: 'Email',
			[PluginSettingType.URL]: 'URL',
			[PluginSettingType.TEXT]: 'Long Text',
			[PluginSettingType.SELECT]: 'Select',
			[PluginSettingType.MULTI_SELECT]: 'Multi Select',
			[PluginSettingType.RADIO]: 'Radio Buttons',
			[PluginSettingType.CHECKBOX]: 'Checkboxes',
			[PluginSettingType.DATE]: 'Date',
			[PluginSettingType.TIME]: 'Time',
			[PluginSettingType.DATETIME]: 'Date & Time',
			[PluginSettingType.FILE]: 'File',
			[PluginSettingType.IMAGE]: 'Image',
			[PluginSettingType.COLOR]: 'Color',
			[PluginSettingType.RANGE]: 'Range'
		};

		return typeMap[type] || type;
	}
}
