/**
 * Project Clarification Agent Types
 */

import { z } from 'zod'

/**
 * Schema for project overview card sections
 */
export const ProjectCardSectionSchema = z.object({
    name: z.string().describe('Section name (e.g., "Backend", "Frontend", "API")'),
    items: z.array(z.string()).describe('List of items/features in this section (e.g., ["API", "Auth", "Webhook"])'),
})

/**
 * Schema for project overview card
 */
export const ProjectOverviewCardSchema = z.object({
    title: z.string().describe('Project title'),
    description: z.string().optional().describe('Project description'),
    sections: z.array(ProjectCardSectionSchema).describe('Array of sections in the card'),
    version: z.number().default(1).describe('Card version (increments on updates)'),
})

/**
 * Schema for requirement update
 */
export const RequirementUpdateSchema = z.object({
    section: z.string().describe('Section name (e.g., "backend", "frontend", "api")'),
    title: z.string().describe('Section title'),
    description: z.string().optional().describe('Detailed description'),
    requirements: z.array(z.string()).optional().describe('Array of requirement items'),
    changeType: z.enum(['added', 'modified', 'removed']).describe('Type of change'),
    changeReason: z.string().optional().describe('Reason for change (from conversation)'),
})

/**
 * Schema for user message input
 */
export const UserMessageInputSchema = z.object({
    message: z.string().describe('User message content'),
    projectId: z.string().optional().describe('Project ID if existing project'),
    conversationId: z.string().optional().describe('Conversation ID for continuing conversation'),
    userId: z.string().optional().describe('User ID'),
})

/**
 * Schema for agent response
 */
export const AgentResponseSchema = z.object({
    message: z.string().describe('Agent response message'),
    cardUpdate: ProjectOverviewCardSchema.optional().describe('Updated project overview card'),
    requirementUpdates: z.array(RequirementUpdateSchema).optional().describe('New or updated requirements'),
    conversationId: z.string().describe('Conversation ID'),
    version: z.number().describe('Current PRD version'),
})

export type ProjectCardSection = z.infer<typeof ProjectCardSectionSchema>
export type ProjectOverviewCard = z.infer<typeof ProjectOverviewCardSchema>
export type RequirementUpdate = z.infer<typeof RequirementUpdateSchema>
export type UserMessageInput = z.infer<typeof UserMessageInputSchema>
export type AgentResponse = z.infer<typeof AgentResponseSchema>

