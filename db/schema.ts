import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
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
export const photoShares = sqliteTable('photo_shares', {
  photoId:text('photo_id').primaryKey().references(()=>records.id,{onDelete:'cascade'}),
  token:text('token').notNull(),
  createdBy:text('created_by').notNull().references(()=>users.id),
  createdAt:integer('created_at').notNull(),
},table=>[uniqueIndex('photo_shares_token_unique').on(table.token)]);
export const apiKeys = sqliteTable('api_keys', {
  id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id),
  name:text('name').notNull(), tokenHash:text('token_hash').notNull(), prefix:text('prefix').notNull(),
  scopes:text('scopes').notNull(), credentialVersion:integer('credential_version').notNull(),
  createdAt:integer('created_at').notNull(), expiresAt:integer('expires_at').notNull(),
}, table=>[uniqueIndex('api_keys_token_hash_unique').on(table.tokenHash)]);

// Historical attribution intentionally survives account/session/key deletion.
export const auditEvents=sqliteTable('audit_events',{
  id:text('id').primaryKey(),createdAt:integer('created_at').notNull(),
  actorId:text('actor_id'),actorName:text('actor_name'),authType:text('auth_type').notNull(),sessionRef:text('session_ref'),
  subjectId:text('subject_id'),action:text('action').notNull(),outcome:text('outcome').notNull(),status:integer('status').notNull(),
  method:text('method').notNull(),path:text('path').notNull(),targetId:text('target_id'),
  ip:text('ip'),userAgent:text('user_agent'),details:text('details').notNull(),eventKey:text('event_key'),
},table=>[index('audit_events_time').on(table.createdAt),index('audit_events_actor_time').on(table.actorId,table.createdAt),
  index('audit_events_action_time').on(table.action,table.createdAt),uniqueIndex('audit_events_event_key').on(table.eventKey)]);
