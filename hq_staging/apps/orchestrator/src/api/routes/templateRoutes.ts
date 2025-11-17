/**
 * Template Management API Routes
 * 
 * Provides HTTP endpoints for template management:
 * - GET /api/templates/:factory - List templates for a factory
 * - POST /api/templates - Create/update template file
 * - DELETE /api/templates/:id - Soft delete template file
 * - GET /api/templates/:id/placeholders - Get placeholders for a template
 * - POST /api/templates/:id/placeholders - Add/update placeholder
 */

import { Hono } from 'hono'
import type { Env } from '../../types'
import { TemplateOps } from '../../entrypoints/TemplateOps'

const app = new Hono<{ Bindings: Env }>()

// Create TemplateOps instance helper
function getTemplateOps(env: Env, ctx: ExecutionContext): TemplateOps {
  return new TemplateOps(ctx, env)
}

/**
 * GET /api/templates/:factory
 * List templates for a factory (optionally filtered by template name)
 */
app.get('/:factory', async (c) => {
  try {
    const factory = c.req.param('factory')
    const templateName = c.req.query('template_name')
    
    const templateOps = getTemplateOps(c.env, c.executionCtx)
    const result = await templateOps.getTemplateFiles({
      factory_name: factory,
      template_name: templateName,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      data: result.templates,
    })
  } catch (error: any) {
    console.error('List templates failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/templates
 * Create or update template file
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { factory_name, template_name, file_path, is_active } = body
    
    if (!factory_name || !template_name || !file_path) {
      return c.json({ error: 'Missing required fields: factory_name, template_name, file_path' }, 400)
    }
    
    const templateOps = getTemplateOps(c.env, c.executionCtx)
    const result = await templateOps.upsertTemplateFile({
      factory_name,
      template_name,
      file_path,
      is_active,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      data: { id: result.id },
    })
  } catch (error: any) {
    console.error('Upsert template file failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * DELETE /api/templates/:id
 * Soft delete template file (set is_active=false)
 */
app.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    // Get template file first to get factory_name, template_name, file_path
    const templateOps = getTemplateOps(c.env, c.executionCtx)
    
    // We need to get the template file details first - for now, use a direct query
    // In production, add a getTemplateFileById method to TemplateOps
    const db = (templateOps as any).db
    const templateFile = await db
      .selectFrom('template_files')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()
    
    if (!templateFile) {
      return c.json({ error: 'Template file not found' }, 404)
    }
    
    const result = await templateOps.upsertTemplateFile({
      factory_name: templateFile.factory_name,
      template_name: templateFile.template_name,
      file_path: templateFile.file_path,
      is_active: false,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      message: 'Template file soft deleted',
    })
  } catch (error: any) {
    console.error('Delete template file failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * GET /api/templates/:id/placeholders
 * Get placeholders for a template file
 */
app.get('/:id/placeholders', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    
    const templateOps = getTemplateOps(c.env, c.executionCtx)
    const result = await templateOps.getPlaceholdersForTemplate({
      template_file_id: id,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      data: result.placeholders,
    })
  } catch (error: any) {
    console.error('Get placeholders failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

/**
 * POST /api/templates/:id/placeholders
 * Add or update placeholder for a template file
 */
app.post('/:id/placeholders', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const { placeholder_id, placeholder_pattern, mini_prompt, is_active } = body
    
    if (!placeholder_id || !placeholder_pattern) {
      return c.json({ error: 'Missing required fields: placeholder_id, placeholder_pattern' }, 400)
    }
    
    const templateOps = getTemplateOps(c.env, c.executionCtx)
    const result = await templateOps.upsertTemplatePlaceholder({
      template_file_id: id,
      placeholder_id,
      placeholder_pattern,
      mini_prompt,
      is_active,
    })
    
    if (!result.ok) {
      return c.json({ error: result.error }, 500)
    }
    
    return c.json({
      success: true,
      data: { id: result.id },
    })
  } catch (error: any) {
    console.error('Upsert placeholder failed:', error)
    return c.json({ error: error.message || 'Internal server error' }, 500)
  }
})

export const templateRoutes = app

