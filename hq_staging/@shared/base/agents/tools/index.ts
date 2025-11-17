/**
 * @shared/base/agents/tools/index.ts
 * 
 * Central export point for all orchestrator entrypoint tools
 */

export { BaseTool, ToolResult, ToolContext } from '@shared/base/agents/BaseTool'
export { GitHub } from './entrypoints/orchestrator/github'
export type { UpsertFileParams, UpsertFileResponse, OpenPRParams, OpenPRResponse } from './entrypoints/orchestrator/github'
export { Tasks } from './entrypoints/orchestrator/tasks'
export type {
    TaskInstructionFile,
    CreateOrderParams,
    CreateOrderResponse,
    GetTasksForOrderParams,
    TasksForOrderResponse,
    GetTaskParams,
    TaskResponse,
    UpdateTaskStatusParams,
    UpdateTaskStatusResponse,
    GetTaskHelpParams,
    TaskHelpResponse,
} from './entrypoints/orchestrator/tasks'
export { Logging } from './entrypoints/orchestrator/logging'
export type { LogParams, LogResponse } from './entrypoints/orchestrator/logging'
export { Delivery } from './entrypoints/orchestrator/delivery'
export type {
    DeployWorkerParams,
    DeployWorkerResponse,
    DeployPagesParams,
    DeployPagesResponse,
} from './entrypoints/orchestrator/delivery'
export { Factory } from './entrypoints/orchestrator/factory'
export type {
    FactoryErrorItem,
    ReportAndRemediateErrorsParams,
    RemediationResult,
    RemediationReportResponse,
} from './entrypoints/orchestrator/factory'
export { Specialist } from './entrypoints/orchestrator/specialist'
export type {
    CreateConflictResolutionParams,
    ConflictResolutionResponse,
    UpdateConflictResolutionParams,
    CreateDeliveryReportParams,
    DeliveryReportResponse,
    CreateOpsOrderParams,
    OpsOrderResponse,
    UpdateOpsOrderParams,
    GetConflictResolutionsParams,
    GetDeliveryReportsParams,
    GetPendingOpsOrdersParams,
} from './entrypoints/orchestrator/specialist'
export { Health } from './entrypoints/orchestrator/health'
export type {
    InitiateHealthCheckParams,
    HealthCheckResponse,
    GetHealthCheckStatusParams,
    WorkerHealthCheckResult,
    TestResult,
    HealthCheckStatusResponse,
    GetHealthCheckHistoryParams,
    HealthCheckHistoryResponse,
    ReceiveHealthCheckResultParams,
    ReceiveHealthCheckResultResponse,
} from './entrypoints/orchestrator/health'
