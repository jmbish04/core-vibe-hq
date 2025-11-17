import { sqliteTable, text, integer, sql } from 'drizzle-orm/sqlite-core';

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  author: text('author').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Type exports for Kysely compatibility
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

// Unified Database interface for Kysely
export type Database = {
  comments: Comment;
};
