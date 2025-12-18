import { z } from 'zod';
import { insertProfileSchema, insertHitRequestSchema, profiles, hitRequests } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  profiles: {
    list: {
      method: 'GET' as const,
      path: '/api/profiles',
      input: z.object({
        search: z.string().optional(),
        minUtr: z.string().optional(),
        maxUtr: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<any>()), // Returns ProfileWithUser[]
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/profiles/:userId',
      responses: {
        200: z.custom<any>(), // Returns ProfileWithUser
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/profiles',
      input: insertProfileSchema.partial(),
      responses: {
        200: z.custom<typeof profiles.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  hitRequests: {
    list: {
      method: 'GET' as const,
      path: '/api/hit-requests',
      responses: {
        200: z.array(z.custom<any>()), // Returns HitRequestWithProfiles[]
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/hit-requests',
      input: insertHitRequestSchema,
      responses: {
        201: z.custom<typeof hitRequests.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/hit-requests/:id/status',
      input: z.object({ status: z.enum(['accepted', 'rejected', 'completed']) }),
      responses: {
        200: z.custom<typeof hitRequests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
