import { BaseEntityModel } from '@gauzy/models';



export interface ServiceLike<E extends BaseEntityModel, CI, UI = Partial<CI>, ID = string>
{

  delete( id: ID ): Promise<void>;

  create( create: CI ): Promise<E>;

  update( id: ID, update: UI ): Promise<E>;

  find( id: ID ): Promise<E>;
  find( filter?: Pick<E, Exclude<keyof E, 'id'>> ): Promise<E[]>;

}
