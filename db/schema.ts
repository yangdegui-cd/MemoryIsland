import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {id:text('id').primaryKey(),userId:text('user_id').notNull(),kind:text('kind').notNull(),data:text('data').notNull(),createdAt:integer('created_at').notNull()});
export const users = sqliteTable('users', {
  id:text('id').primaryKey(), name:text('name').notNull(), timeZone:text('time_zone').notNull().default('UTC'),
  isPrimary:integer('is_primary',{mode:'boolean'}).notNull().default(false),
  passwordHash:text('password_hash'), passwordSalt:text('password_salt'),
  credentialVersion:integer('credential_version').notNull().default(0),
  failedAttempts:integer('failed_attempts').notNull().default(0), lockedUntil:integer('locked_until').notNull().default(0),
  createdAt:integer('created_at').notNull(), updatedAt:integer('updated_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  tokenHash:text('token_hash').primaryKey(), userId:text('user_id').notNull().references(()=>users.id),
  credentialVersion:integer('credential_version').notNull(), expiresAt:integer('expires_at').notNull(),
});
export const apiKeys = sqliteTable('api_keys', {
  id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id),
  name:text('name').notNull(), tokenHash:text('token_hash').notNull(), prefix:text('prefix').notNull(),
  scopes:text('scopes').notNull(), credentialVersion:integer('credential_version').notNull(),
  createdAt:integer('created_at').notNull(), expiresAt:integer('expires_at').notNull(),
}, table=>[uniqueIndex('api_keys_token_hash_unique').on(table.tokenHash)]);
