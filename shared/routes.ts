import { z } from 'zod';
import {
  insertContactSchema, insertInteractionSchema, insertMeetingSchema, insertEventSchema,
  insertEventAttendanceSchema, insertImpactLogSchema, insertImpactLogContactSchema,
  insertImpactTaxonomySchema, insertImpactTagSchema, insertKeywordDictionarySchema,
  insertActionItemSchema, insertConsentRecordSchema, insertAuditLogSchema,
  contacts, interactions, meetings, events,
  eventAttendance, impactLogs, impactLogContacts, impactTaxonomy, impactTags,
  keywordDictionary, actionItems, consentRecords, auditLog,
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
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

// ============================================
// API CONTRACT
// ============================================
export const api = {
  contacts: {
    list: {
      method: 'GET' as const,
      path: '/api/contacts' as const,
      responses: {
        200: z.array(z.custom<typeof contacts.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/contacts/:id' as const,
      responses: {
        200: z.custom<typeof contacts.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/contacts' as const,
      input: insertContactSchema,
      responses: {
        201: z.custom<typeof contacts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/contacts/:id' as const,
      input: insertContactSchema.partial(),
      responses: {
        200: z.custom<typeof contacts.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/contacts/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  interactions: {
    list: {
      method: 'GET' as const,
      path: '/api/interactions' as const,
      input: z.object({
        contactId: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof interactions.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/interactions' as const,
      input: insertInteractionSchema,
      responses: {
        201: z.custom<typeof interactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    analyze: {
      method: 'POST' as const,
      path: '/api/analyze-interaction' as const,
      input: z.object({ text: z.string() }),
      responses: {
        200: z.object({
          summary: z.string(),
          keywords: z.array(z.string()),
          metrics: z.object({
            mindset: z.number(),
            skill: z.number(),
            confidence: z.number(),
          }),
        }),
        500: errorSchemas.internal,
      },
    },
  },
  meetings: {
    list: {
      method: 'GET' as const,
      path: '/api/meetings' as const,
      responses: {
        200: z.array(z.custom<typeof meetings.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/meetings/:id' as const,
      responses: {
        200: z.custom<typeof meetings.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/meetings' as const,
      input: insertMeetingSchema,
      responses: {
        201: z.custom<typeof meetings.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/meetings/:id' as const,
      input: insertMeetingSchema.partial(),
      responses: {
        200: z.custom<typeof meetings.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/meetings/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events' as const,
      responses: {
        200: z.array(z.custom<typeof events.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/events/:id' as const,
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/events' as const,
      input: insertEventSchema,
      responses: {
        201: z.custom<typeof events.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/events/:id' as const,
      input: insertEventSchema.partial(),
      responses: {
        200: z.custom<typeof events.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/events/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  eventAttendance: {
    list: {
      method: 'GET' as const,
      path: '/api/event-attendance/:eventId' as const,
      responses: {
        200: z.array(z.custom<typeof eventAttendance.$inferSelect>()),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/event-attendance' as const,
      input: insertEventAttendanceSchema,
      responses: {
        201: z.custom<typeof eventAttendance.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    remove: {
      method: 'DELETE' as const,
      path: '/api/event-attendance/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  impactLogs: {
    list: {
      method: 'GET' as const,
      path: '/api/impact-logs' as const,
      responses: {
        200: z.array(z.custom<typeof impactLogs.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/impact-logs/:id' as const,
      responses: {
        200: z.custom<typeof impactLogs.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/impact-logs' as const,
      input: insertImpactLogSchema,
      responses: {
        201: z.custom<typeof impactLogs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/impact-logs/:id' as const,
      input: insertImpactLogSchema.partial(),
      responses: {
        200: z.custom<typeof impactLogs.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/impact-logs/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    contacts: {
      list: {
        method: 'GET' as const,
        path: '/api/impact-logs/:id/contacts' as const,
        responses: {
          200: z.array(z.custom<typeof impactLogContacts.$inferSelect>()),
        },
      },
      add: {
        method: 'POST' as const,
        path: '/api/impact-logs/:id/contacts' as const,
        input: insertImpactLogContactSchema,
        responses: {
          201: z.custom<typeof impactLogContacts.$inferSelect>(),
        },
      },
      remove: {
        method: 'DELETE' as const,
        path: '/api/impact-log-contacts/:id' as const,
        responses: {
          204: z.void(),
        },
      },
    },
    tags: {
      list: {
        method: 'GET' as const,
        path: '/api/impact-logs/:id/tags' as const,
        responses: {
          200: z.array(z.custom<typeof impactTags.$inferSelect>()),
        },
      },
      add: {
        method: 'POST' as const,
        path: '/api/impact-logs/:id/tags' as const,
        input: insertImpactTagSchema,
        responses: {
          201: z.custom<typeof impactTags.$inferSelect>(),
        },
      },
      remove: {
        method: 'DELETE' as const,
        path: '/api/impact-tags/:id' as const,
        responses: {
          204: z.void(),
        },
      },
    },
  },
  taxonomy: {
    list: {
      method: 'GET' as const,
      path: '/api/taxonomy' as const,
      responses: {
        200: z.array(z.custom<typeof impactTaxonomy.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/taxonomy' as const,
      input: insertImpactTaxonomySchema,
      responses: {
        201: z.custom<typeof impactTaxonomy.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/taxonomy/:id' as const,
      input: insertImpactTaxonomySchema.partial(),
      responses: {
        200: z.custom<typeof impactTaxonomy.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/taxonomy/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  keywords: {
    list: {
      method: 'GET' as const,
      path: '/api/keywords' as const,
      responses: {
        200: z.array(z.custom<typeof keywordDictionary.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/keywords' as const,
      input: insertKeywordDictionarySchema,
      responses: {
        201: z.custom<typeof keywordDictionary.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/keywords/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  actionItems: {
    list: {
      method: 'GET' as const,
      path: '/api/action-items' as const,
      responses: {
        200: z.array(z.custom<typeof actionItems.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/action-items' as const,
      input: insertActionItemSchema,
      responses: {
        201: z.custom<typeof actionItems.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/action-items/:id' as const,
      input: insertActionItemSchema.partial(),
      responses: {
        200: z.custom<typeof actionItems.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/action-items/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  consent: {
    list: {
      method: 'GET' as const,
      path: '/api/contacts/:id/consent' as const,
      responses: {
        200: z.array(z.custom<typeof consentRecords.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/contacts/:id/consent' as const,
      input: insertConsentRecordSchema,
      responses: {
        201: z.custom<typeof consentRecords.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  auditLogs: {
    list: {
      method: 'GET' as const,
      path: '/api/audit-logs' as const,
      responses: {
        200: z.array(z.custom<typeof auditLog.$inferSelect>()),
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
