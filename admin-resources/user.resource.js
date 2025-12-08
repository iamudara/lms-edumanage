import { User } from '../models/index.js';

export const UserResource = {
  resource: User,
  options: {
    listProperties: ['id', 'username', 'email', 'full_name', 'role', 'batch_id'],
    editProperties: ['username', 'email', 'password', 'full_name', 'role', 'batch_id'],
    filterProperties: ['username', 'email', 'role', 'batch_id'],
  }
};
