/**
 * Project Clarification Agent
 * 
 * Interacts with users via chat to understand and confirm project requirements.
 * Shows a generative UI card in chat that updates in real-time as the conversation evolves.
 * Stores all requirements in versioned D1 tables for traceability.
 * 
 * Features:
 * - Real-time card updates via WebSocket
 * - Versioned requirement storage
 * - Comprehensive conversation logging
 * - PRD updates based on conversation
 */

import { BaseAgent, type AgentContext, type StructuredLogger } from '@shared/base/agents/BaseAgent'
import { projectRequirements, projectOverviewCards } from '../../database/projects/schema'
import { conversationLogs } from '../../database/chat/schema'
import { eq, desc, and } from 'drizzle-orm'
import { createDatabaseService } from '../../database/database'
import type { Env } from '../../types'
import type {
    UserMessageInput,
    AgentResponse,
    ProjectOverviewCard,
    RequirementUpdate,
} from './types'


export class ProjectClarificationAgent extends BaseAgent {
    private conversationId: string
    // Orchestrator-specific: Direct database access for queries
    private db: ReturnType<typeof createDatabaseService>

    constructor(env: Env, logger: StructuredLogger, context: AgentContext = {}) {
        super(env, logger, context)
        this.conversationId = context.conversationId || crypto.randomUUID()
        this.context.conversationId = this.conversationId
        // Initialize database service for orchestrator-specific queries
        this.db = createDatabaseService(env)
    }

    /**
     * Process a user message and generate response
     */
    async execute(input: UserMessageInput): Promise<AgentResponse> {
        return this.executeWithLogging('process_user_message', async () => {
            // Update context from input
            if (input.projectId) this.context.projectId = input.projectId
            if (input.userId) this.context.userId = input.userId
            if (input.conversationId) {
                this.conversationId = input.conversationId
                this.context.conversationId = this.conversationId
            }

            // Log user message
            await this.logUserMessage(input.message, 'user')

            // Get current project state
            const currentCard = await this.getCurrentCard()
            const currentVersion = await this.getCurrentVersion()

            // TODO: Integrate with AI to:
            // 1. Analyze user message
            // 2. Extract requirements/changes
            // 3. Update card structure
            // 4. Generate response message
            // For now, using placeholder logic

            // Analyze message for requirements (placeholder)
            const updates = this.analyzeMessageForUpdates(input.message, currentCard)
            
            // Update requirements in D1 (versioned)
            const newVersion = currentVersion + 1
            if (updates.requirementUpdates && updates.requirementUpdates.length > 0) {
                for (const reqUpdate of updates.requirementUpdates) {
                    await this.saveRequirement(reqUpdate, newVersion)
                }
            }

            // Update card
            const updatedCard = this.updateCard(currentCard, updates.cardUpdate)
            await this.saveCard(updatedCard)

            // Generate agent response
            const response: AgentResponse = {
                message: updates.message || 'I understand. Let me update the project overview.',
                cardUpdate: updatedCard,
                requirementUpdates: updates.requirementUpdates,
                conversationId: this.conversationId,
                version: newVersion,
            }

            // Log agent response
            await this.logUserMessage(response.message, 'agent', {
                cardUpdate: updatedCard,
                requirementUpdates: updates.requirementUpdates,
            })

            // Send WebSocket update
            await this.sendCardUpdate(updatedCard, newVersion)

            return response
        })
    }

    /**
     * Analyze user message to extract requirements and updates
     * TODO: Replace with AI integration
     */
    private analyzeMessageForUpdates(
        message: string,
        currentCard: ProjectOverviewCard | null
    ): {
        message?: string
        cardUpdate?: Partial<ProjectOverviewCard>
        requirementUpdates?: RequirementUpdate[]
    } {
        const lowerMessage = message.toLowerCase()

        // Simple keyword detection (placeholder - replace with AI)
        const updates: RequirementUpdate[] = []
        let cardUpdate: Partial<ProjectOverviewCard> | undefined
        let responseMessage = ''

        // Detect frontend mention
        if (lowerMessage.includes('frontend') || lowerMessage.includes('ui') || lowerMessage.includes('interface')) {
            if (!currentCard?.sections.find(s => s.name.toLowerCase() === 'frontend')) {
                updates.push({
                    section: 'frontend',
                    title: 'Frontend',
                    description: 'User interface components and views',
                    requirements: [],
                    changeType: 'added',
                    changeReason: message,
                })
                cardUpdate = {
                    sections: [
                        ...(currentCard?.sections || []),
                        { name: 'Frontend', items: [] },
                    ],
                }
                responseMessage = "I've added a Frontend section to your project. What specific features would you like in the frontend?"
            }
        }

        // Detect backend mention
        if (lowerMessage.includes('backend') || lowerMessage.includes('api') || lowerMessage.includes('server')) {
            if (!currentCard?.sections.find(s => s.name.toLowerCase() === 'backend')) {
                updates.push({
                    section: 'backend',
                    title: 'Backend',
                    description: 'Server-side logic and API endpoints',
                    requirements: [],
                    changeType: 'added',
                    changeReason: message,
                })
                cardUpdate = {
                    sections: [
                        ...(currentCard?.sections || []),
                        { name: 'Backend', items: ['API', 'Auth'] },
                    ],
                }
                responseMessage = 'I\'ve added a Backend section with API and Auth. What else do you need in the backend?'
            }
        }

        // Detect Discord bot mention
        if (lowerMessage.includes('discord') && lowerMessage.includes('bot')) {
            if (!currentCard) {
                cardUpdate = {
                    title: 'Discord Bot',
                    description: 'A Discord bot worker',
                    sections: [
                        { name: 'Backend', items: ['API', 'Auth', 'Webhook', 'Actions'] },
                    ],
                }
                responseMessage = 'Great! I see you want to build a Discord bot. I\'ve set up the initial structure with Backend components (API, Auth, Webhook, Actions). What else would you like to add?'
            }
        }

        return {
            message: responseMessage || 'I understand. Let me update the project overview.',
            cardUpdate,
            requirementUpdates: updates.length > 0 ? updates : undefined,
        }
    }

    /**
     * Get current project overview card
     */
    private async getCurrentCard(): Promise<ProjectOverviewCard | null> {
        if (!this.context.projectId) return null

        const cards = await this.db.projects
            .select()
            .from(projectOverviewCards)
            .where(
                and(
                    eq(projectOverviewCards.projectId, this.context.projectId),
                    eq(projectOverviewCards.conversationId, this.conversationId)
                )
            )
            .orderBy(desc(projectOverviewCards.version))
            .limit(1)

        if (cards.length === 0) return null

        return {
            title: cards[0].title,
            description: cards[0].description || undefined,
            sections: cards[0].sections as ProjectOverviewCard['sections'],
            version: cards[0].version,
        }
    }

    /**
     * Get current PRD version
     */
    private async getCurrentVersion(): Promise<number> {
        if (!this.context.projectId) return 0

        const versions = await this.db.projects
            .select({ version: projectRequirements.version })
            .from(projectRequirements)
            .where(eq(projectRequirements.projectId, this.context.projectId))
            .orderBy(desc(projectRequirements.version))
            .limit(1)

        return versions[0]?.version || 0
    }

    /**
     * Update card with new information
     */
    private updateCard(
        current: ProjectOverviewCard | null,
        updates: Partial<ProjectOverviewCard> | undefined
    ): ProjectOverviewCard {
        if (!current && !updates) {
            // Create new card
            return {
                title: 'New Project',
                description: '',
                sections: [],
                version: 1,
            }
        }

        const base = current || {
            title: 'New Project',
            description: '',
            sections: [],
            version: 1,
        }

        return {
            title: updates?.title || base.title,
            description: updates?.description ?? base.description,
            sections: updates?.sections || base.sections,
            version: base.version + (updates ? 1 : 0),
        }
    }

    /**
     * Save requirement to D1 (versioned)
     */
    private async saveRequirement(update: RequirementUpdate, version: number): Promise<void> {
        await this.db.projects.insert(projectRequirements).values({
            projectId: this.context.projectId || 'unknown',
            version,
            section: update.section,
            title: update.title,
            description: update.description || null,
            requirements: update.requirements || [],
            changeType: update.changeType,
            changeReason: update.changeReason || null,
            agentName: 'project-clarification',
            conversationId: this.conversationId,
            userId: this.context.userId || null,
        })
    }

    /**
     * Save card to D1
     */
    private async saveCard(card: ProjectOverviewCard): Promise<void> {
        if (!this.context.projectId) return

        await this.db.projects.insert(projectOverviewCards).values({
            projectId: this.context.projectId,
            conversationId: this.conversationId,
            title: card.title,
            description: card.description || null,
            sections: card.sections,
            version: card.version,
        })
    }

    /**
     * Log user or agent message
     */
    private async logUserMessage(
        message: string,
        role: 'user' | 'agent',
        structuredData?: Record<string, unknown>
    ): Promise<void> {
        await this.db.chats.insert(conversationLogs).values({
            conversationId: this.conversationId,
            projectId: this.context.projectId || null,
            userId: this.context.userId || null,
            agentName: 'project-clarification',
            role,
            message,
            messageType: structuredData ? 'card_update' : 'text',
            structuredData: structuredData || null,
            websocketSent: false, // Will be set when WebSocket is sent
        })
    }

    /**
     * Send card update via WebSocket
     */
    private async sendCardUpdate(card: ProjectOverviewCard, version: number): Promise<void> {
        await this.sendWebSocketUpdate({
            type: 'project_card_update',
            projectId: this.context.projectId,
            conversationId: this.conversationId,
            card,
            version,
            timestamp: new Date().toISOString(),
        })
    }
}

