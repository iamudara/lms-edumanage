import { Batch } from '../models/index.js';

export const BatchResource = {
  resource: Batch,
  options: {
    listProperties: ['id', 'name', 'code', 'year'],
    editProperties: ['name', 'code', 'description', 'year'],
  }
};
