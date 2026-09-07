/**
 * The 11 seeded system categories — created per organization with `isSystem: true`.
 * The AI classifier's category vocabulary is always read from the live catalog at
 * classification time, never from this list.
 */
export interface IDefaultDocumentCategory {
	name: string;
	slug: string;
	color: string;
	icon: string;
}

export const DEFAULT_DOCUMENT_CATEGORIES: IDefaultDocumentCategory[] = [
	{ name: 'Invoice', slug: 'invoice', color: '#3366ff', icon: 'file-text-outline' },
	{ name: 'Contract', slug: 'contract', color: '#8950fc', icon: 'edit-2-outline' },
	{ name: 'Report', slug: 'report', color: '#00d68f', icon: 'bar-chart-outline' },
	{ name: 'Policy', slug: 'policy', color: '#0095ff', icon: 'shield-outline' },
	{ name: 'Customer List', slug: 'customer-list', color: '#ffaa00', icon: 'people-outline' },
	{ name: 'Expense', slug: 'expense', color: '#ff3d71', icon: 'credit-card-outline' },
	{ name: 'HR', slug: 'hr', color: '#00b383', icon: 'person-outline' },
	{ name: 'Legal', slug: 'legal', color: '#6610f2', icon: 'briefcase-outline' },
	{ name: 'Meeting Notes', slug: 'meeting-notes', color: '#42aaff', icon: 'calendar-outline' },
	{ name: 'Specification', slug: 'specification', color: '#598bff', icon: 'layers-outline' },
	{ name: 'Other', slug: 'other', color: '#8f9bb3', icon: 'folder-outline' }
];
