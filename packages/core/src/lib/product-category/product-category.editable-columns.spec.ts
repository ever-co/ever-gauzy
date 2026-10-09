/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `product.service.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { editableColumns } from './product-category.service';

/**
 * The columns a category edit writes.
 *
 * The edit writes only the members it lists, and the image may arrive either as `imageId` or as the
 * `image` relation object — the shape the delete-and-resave edit on develop accepted, because it saved
 * the payload whole.
 */
describe('editableColumns — the members a product-category edit writes', () => {
	const IMAGE = '00000000-0000-4000-8000-0000000000a1';
	const OTHER_IMAGE = '00000000-0000-4000-8000-0000000000a2';

	it('reads the image relation object as imageId when imageId is not stated', () => {
		expect(editableColumns({ image: { id: IMAGE } } as never)).toEqual({ imageId: IMAGE });
	});

	it('clears the image when the relation is stated as null', () => {
		expect(editableColumns({ image: null } as never)).toEqual({ imageId: null });
	});

	it('lets a stated imageId win over the relation object', () => {
		expect(editableColumns({ imageId: IMAGE, image: { id: OTHER_IMAGE } } as never)).toEqual({ imageId: IMAGE });
	});

	it('states nothing about the image when neither member is sent', () => {
		expect(editableColumns({ slug: 'apparel' } as never)).toEqual({ slug: 'apparel' });
	});

	it('still drops members that are not editable columns', () => {
		expect(editableColumns({ tenantId: 'x', organizationId: 'y', slug: 'apparel' } as never)).toEqual({
			slug: 'apparel'
		});
	});
});
