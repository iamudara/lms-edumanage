import { Batch, User } from '../models/index.js';
import { ValidationError } from 'adminjs';

export const BatchResource = {
  resource: Batch,
  options: {
    navigation: {
      name: 'Academic Management',
      icon: 'Layers'
    },
    listProperties: ['id', 'name', 'code', 'year'],
    editProperties: ['name', 'code', 'description', 'year'],
    actions: {
      delete: {
        before: async (request, context) => {
          if (request.method === 'post') {
            const batchId = context.record.id();

            // Check for associated users
            const userCount = await User.count({ where: { batch_id: batchId } });
            if (userCount > 0) {
              throw new ValidationError(
                {
                  base: {
                    message: 'validation error'
                  }
                },
                {
                  message: 'cant delete this batch because still have users in this batch'
                }
              );
            }
          }
          return request;
        }
      }
    }
  }
};
