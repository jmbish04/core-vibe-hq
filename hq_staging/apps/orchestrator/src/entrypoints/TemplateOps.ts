/**
 * orchestrator/worker/entrypoints/TemplateOps.ts
 * ------------------------------------------------------------
 * Template Management RPC Entrypoint
 * 
 * Provides RPC methods for managing template files and placeholders.
 * Exposed via service binding for downstream factory workers.
 * 
 * Responsibilities:
 * - CRUD operations for template files (insert/update/soft delete)
 * - CRUD operations for template placeholders
 * - Query template files and placeholders
 * - Retrieve order placeholder mappings
 * ------------------------------------------------------------
 * (Kysely-enabled)
 */

import type { CoreEnv } from '@shared/types/env'
import { BaseWorkerEntrypoint } from '@shared/base/workerEntrypoint'
import { sql } from 'kysely'

export interface UpsertTemplateFileParams {
  factory_name: string
  template_name: string
  file_path: string
  is_active?: boolean
}

export interface UpsertTemplatePlaceholderParams {
  template_file_id: number
  placeholder_id: string
  placeholder_pattern: string
  mini_prompt?: string
  is_active?: boolean
}

export interface TemplateFile {
  id: number
  factory_name: string
  template_name: string
  file_path: string
  is_active: boolean
  created_at: number
  updated_at: number
}

export interface TemplatePlaceholder {
  id: number
  template_file_id: number
  placeholder_id: string
  placeholder_pattern: string
  mini_prompt: string | null
  is_active: boolean
  created_at: number
  updated_at: number
}

export interface OrderPlaceholderMapping {
  id: number
  order_id: string
  project_id: string | null
  template_file_id: number
  placeholder_id: string
  mini_prompt: string
  created_at: number
}

export interface GetTemplateFilesResponse {
  ok: boolean
  templates?: TemplateFile[]
  error?: string
}

export interface GetPlaceholdersResponse {
  ok: boolean
  placeholders?: TemplatePlaceholder[]
  error?: string
}

export interface GetOrderPlaceholderMappingResponse {
  ok: boolean
  mappings?: OrderPlaceholderMapping[]
  error?: string
}

export class TemplateOps extends BaseWorkerEntrypoint<CoreEnv> {

  /**
   * Upsert template file (insert or update, soft delete via is_active=false)
   */
  async upsertTemplateFile(params: UpsertTemplateFileParams): Promise<{ ok: boolean; id?: number; error?: string }> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'upsert_template_file',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      // Check if template file exists using Kysely
      const existing = await this.db
        .selectFrom('template_files')
        .selectAll()
        .where('factory_name', '=', params.factory_name)
        .where('template_name', '=', params.template_name)
        .where('file_path', '=', params.file_path)
        .executeTakeFirst()

      if (existing) {
        // Update existing
        const updated = await this.db
          .updateTable('template_files')
          .set({
            is_active: params.is_active ?? (existing.is_active === 1),
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where('id', '=', existing.id)
          .returning('id')
          .executeTakeFirst()

        return { ok: true, id: updated?.id }
      } else {
        // Insert new
        const inserted = await this.db
          .insertInto('template_files')
          .values({
            factory_name: params.factory_name,
            template_name: params.template_name,
            file_path: params.file_path,
            is_active: params.is_active ?? true,
          })
          .returning('id')
          .executeTakeFirst()

        return { ok: true, id: inserted?.id }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'upsert_template_file',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Upsert template placeholder
   */
  async upsertTemplatePlaceholder(params: UpsertTemplatePlaceholderParams): Promise<{ ok: boolean; id?: number; error?: string }> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'upsert_template_placeholder',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      // Check if placeholder exists using Kysely
      const existing = await this.db
        .selectFrom('template_placeholders')
        .selectAll()
        .where('template_file_id', '=', params.template_file_id)
        .where('placeholder_id', '=', params.placeholder_id)
        .executeTakeFirst()

      if (existing) {
        // Update existing
        const updated = await this.db
          .updateTable('template_placeholders')
          .set({
            placeholder_pattern: params.placeholder_pattern,
            mini_prompt: params.mini_prompt ?? existing.mini_prompt,
            is_active: params.is_active ?? (existing.is_active === 1),
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where('id', '=', existing.id)
          .returning('id')
          .executeTakeFirst()

        return { ok: true, id: updated?.id }
      } else {
        // Insert new
        const inserted = await this.db
          .insertInto('template_placeholders')
          .values({
            template_file_id: params.template_file_id,
            placeholder_id: params.placeholder_id,
            placeholder_pattern: params.placeholder_pattern,
            mini_prompt: params.mini_prompt,
            is_active: params.is_active ?? true,
          })
          .returning('id')
          .executeTakeFirst()

        return { ok: true, id: inserted?.id }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'upsert_template_placeholder',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Get template files for a factory (optionally filtered by template name)
   */
  async getTemplateFiles(params: { factory_name: string; template_name?: string }): Promise<GetTemplateFilesResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'get_template_files',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      let query = this.db
        .selectFrom('template_files')
        .selectAll()
        .where('factory_name', '=', params.factory_name)
        .where('is_active', '=', 1)

      if (params.template_name) {
        query = query.where('template_name', '=', params.template_name)
      }

      const templates = await query.execute()

      return { ok: true, templates: templates as TemplateFile[] }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'get_template_files',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Get placeholders for a template file
   */
  async getPlaceholdersForTemplate(params: { template_file_id: number }): Promise<GetPlaceholdersResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'get_placeholders_for_template',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      const placeholders = await this.db
        .selectFrom('template_placeholders')
        .selectAll()
        .where('template_file_id', '=', params.template_file_id)
        .where('is_active', '=', 1)
        .execute()

      return { ok: true, placeholders: placeholders as TemplatePlaceholder[] }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'get_placeholders_for_template',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }

  /**
   * Get order placeholder mapping for an order
   */
  async getOrderPlaceholderMapping(params: { order_id: string }): Promise<GetOrderPlaceholderMappingResponse> {
    try {
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'get_order_placeholder_mapping',
          level: 'info',
          details: JSON.stringify(params),
        })
        .execute()

      const mappings = await this.db
        .selectFrom('order_placeholder_mappings')
        .selectAll()
        .where('order_id', '=', params.order_id)
        .execute()

      return { ok: true, mappings: mappings as OrderPlaceholderMapping[] }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await this.db
        .insertInto('operation_logs')
        .values({
          source: 'template_ops.rpc',
          operation: 'get_order_placeholder_mapping',
          level: 'error',
          details: JSON.stringify({ ...params, error: errorMessage }),
        })
        .execute()
      return { ok: false, error: errorMessage }
    }
  }
}

