import { IBasePerTenantAndOrganizationEntityModel, ID, IProduct, IUser } from '@gauzy/contracts';

export type ProductReviewStatus = 'approved' | 'pending' | 'rejected';

// Enum for product review status
export enum ProductReviewStatusEnum {
	APPROVED = 'approved',
	PENDING = 'pending',
	REJECTED = 'rejected'
}

export interface IProductReview extends IBasePerTenantAndOrganizationEntityModel {
	title: string;
	description: string;
	rating: number;
	upvotes: number;
	downvotes: number;
	status: ProductReviewStatus;
	product?: IProduct;
	productId?: ID;
	user?: IUser;
	userId?: ID;
}
