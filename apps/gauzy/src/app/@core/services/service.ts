import { ServiceLike } from './service-like';
import { BaseEntityModel } from '@gauzy/models';



export class Service<E extends BaseEntityModel, CI, UI = Partial<CI>, ID = string> implements ServiceLike<E, CI, UI, ID>
{

  protected entries: E[] = [];

  constructor()
  {
    console.log( '@@@', this );
  }

  public async create( create: CI ): Promise<E>
  {
    const entry: E = {
      id: btoa( `${ Date.now() }.${ Math.random() }` ),
      ...create,
    } as any;

    this.entries.push( entry );

    return entry;
  }

  public async delete( id: ID ): Promise<void>
  {
    await this.find( id );

    const index = this.entries.findIndex( ( { id: _id }) => _id === id as any );

    this.entries.splice( index, 1 );
  }

  public find( id: ID ): Promise<E>;
  public find( filter?: Pick<E, Exclude<keyof E, "id">> ): Promise<E[]>;
  public async find( idOrFilter?: ID | Pick<E, Exclude<keyof E, "id">> ): Promise<E | E[]>
  {
    let result: E[] | E = this.entries;

    if ( 'string' === typeof idOrFilter ) {
      result = result.find( ({ id }) => id === idOrFilter );

      if ( !result ) {
        throw new Error( 'Not found - { id: "' + idOrFilter + '" }' );
      }
    } else if ( idOrFilter ) {
      result = result.filter( entry =>
        Object.keys( idOrFilter )
        .every( key => idOrFilter[ key ] === entry[ key ] ) );
    }

    return this.clone( result );
  }

  public async update( id: ID, update: UI ): Promise<E>
  {
    const entry = await this.find( id );

    Object.assign( entry, update );

    return this.clone( entry );
  }

  public clone<T extends E[] | E>( entity: T ): T {
    return [ void 0, null ].includes( entity ) ? entity
      : JSON.parse( JSON.stringify( entity ) );
  }

}
