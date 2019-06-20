
export interface User {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
