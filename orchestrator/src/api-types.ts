/**
 * Centralized API types - imports and re-exports types from worker
 * This file serves as the single source of truth for frontend-worker API communication
 */
import { SessionResponse } from 'worker/utils/authUtils';
import { AuthUser } from './api-types';

export type { SecretTemplate } from 'worker/types/secretsTemplates';

// Base API Response Types
export type { ControllerResponse, ApiResponse } from 'worker/api/controllers/types';

// Database Types
export type {
  PaginationInfo,
  EnhancedAppData,
  AppWithFavoriteStatus,
  TimePeriod,
  AppSortOption,
  SortOrder,
  AppQueryOptions,
  PublicAppQueryOptions
} from 'worker/database/types';

// App-related API Types
export type { 
  AppsListData,
  PublicAppsData, 
  SingleAppData,
  FavoriteToggleData,
  CreateAppData,
  UpdateAppVisibilityData,
  AppDeleteData,
  AppWithUserAndStats
} from 'worker/api/controllers/apps/types';

export type {
  AppDetailsData,
  AppStarToggleData,
  GeneratedCodeFile,
  GitCloneTokenData
} from 'worker/api/controllers/appView/types';

// User-related API Types
export type {
  UserAppsData,
  ProfileUpdateData,
} from 'worker/api/controllers/user/types';

// Stats API Types
export type {
  UserStatsData,
  UserActivityData
} from 'worker/api/controllers/stats/types';

// Analytics API Types
export type {
  UserAnalyticsResponseData,
  AgentAnalyticsResponseData,
} from 'worker/api/controllers/analytics/types';

export type { PlatformStatusData } from 'worker/api/controllers/status/types';

// Model Config API Types
export type {
  ModelConfigsData,
  ModelConfigData,
  ModelConfigUpdateData,
  ModelConfigTestData,
  ModelConfigResetData,
  ModelConfigDefaultsData,
  ModelConfigDeleteData,
  ByokProvidersData,
  UserProviderStatus,
  ModelsByProvider
} from 'worker/api/controllers/modelConfig/types';

// Model Provider API Types
export type {
  ModelProvidersListData,
  ModelProviderData,
  ModelProviderCreateData,
  ModelProviderUpdateData,
  ModelProviderDeleteData,
  ModelProviderTestData,
  CreateProviderRequest,
  UpdateProviderRequest,
  TestProviderRequest
} from 'worker/api/controllers/modelProviders/types';

// Frontend model config update interface that matches backend schema
export interface ModelConfigUpdate {
  modelName?: string | null;
  maxTokens?: number | null;
  temperature?: number | null;
  reasoningEffort?: string | null;
  fallbackModel?: string | null;
  isUserOverride?: boolean;
}

// Secrets API Types
export type {
  SecretsData,
  SecretStoreData,
  SecretDeleteData,
  SecretTemplatesData
} from 'worker/api/controllers/secrets/types';

// Agent/CodeGen API Types  
export type {
  AgentConnectionData,
} from 'worker/api/controllers/agent/types';

// WebSocket Types
export type { 
  WebSocketMessage, 
  WebSocketMessageData,
  CodeFixEdits 
} from 'worker/api/websocketTypes';

// Database/Schema Types commonly used in frontend
export type { 
  App,
  User,
  UserModelConfig,
  UserModelProvider
} from 'worker/database/schema';

export type {
  FavoriteToggleResult,
  UserStats,
  UserActivity,
  EncryptedSecret,
  UserModelConfigWithMetadata,
  ModelTestResult
} from 'worker/database/types';

// Agent/Generator Types
export type { 
  Blueprint as BlueprintType,
  CodeReviewOutputType,
  FileConceptType,
  FileOutputType as GeneratedFile,
} from 'worker/agents/schemas';

export type { 
  CodeGenState 
} from 'worker/agents/core/state';

export type {
  ConversationMessage,
} from 'worker/agents/inferutils/common';

export type { 
  RuntimeError,
  StaticAnalysisResponse 
} from 'worker/services/sandbox/sandboxTypes';

// Config/Inference Types
export type { 
  AgentActionKey,
  AgentConfig,
  ModelConfig,
  ReasoningEffortType as ReasoningEffort,
  ProviderOverrideType as ProviderOverride
} from 'worker/agents/inferutils/config.types';

export type { RateLimitError } from "worker/services/rate-limit/errors";
export type { AgentPreviewResponse, CodeGenArgs } from 'worker/api/controllers/agent/types';
export type { RateLimitErrorResponse } from 'worker/api/responses';
export { RateLimitExceededError, SecurityError, SecurityErrorType } from '@shared/types/errors';

// HIL (Human-in-the-Loop) API Types
export type {
  GetHilRequestsParams,
  GetHilRequestsResponse,
  GetHilRequestResponse,
  SubmitHilResponseParams,
  UpdateHilStatusParams,
  SubmitHilResponseResponse,
  UpdateHilStatusResponse
} from 'worker/entrypoints/HilOps';

// Health Check API Types
export interface HealthCheckSummary {
	totalChecks: number;
	lastCompletedAt: string | null;
	lastStatus: string | null;
	lastHealthScore: number | null;
}

export interface HealthCheckSummaryResponse {
	ok: boolean;
	summary: HealthCheckSummary;
	latest: HealthCheckStatusResponse | null;
}

export interface WorkerInfo {
	name: string;
	type: string;
	url: string | null;
	binding: string | null;
}

export interface WorkersResponse {
	ok: boolean;
	workers: WorkerInfo[];
}

export interface WorkerHealthResult {
	worker_check_uuid: string;
	worker_name: string;
	worker_type: string;
	status: string;
	overall_status: string | null;
	health_score: number | null;
	error_message: string | null;
	created_at: string;
	completed_at: string | null;
}

export interface HealthCheckStatusResponse {
	health_check_uuid: string;
	status: string;
	total_workers: number;
	completed_workers: number;
	passed_workers: number;
	failed_workers: number;
	overall_health_score: number;
	ai_analysis?: string;
	ai_recommendations?: string;
	worker_results: WorkerHealthResult[];
}

export interface HealthCheckStatusData {
	ok: boolean;
	result: HealthCheckStatusResponse;
}

export interface HealthCheckHistoryItem {
	health_check_uuid: string;
	status: string;
	trigger_type: string;
	trigger_source: string;
	total_workers: number;
	completed_workers: number;
	passed_workers: number;
	failed_workers: number;
	overall_health_score: number;
	created_at: string;
	completed_at: string | null;
}

export interface HealthCheckHistoryResponse {
	ok: boolean;
	history: {
		health_checks: HealthCheckHistoryItem[];
		total_count: number;
		page: number;
		limit: number;
	};
}

export interface InitiateHealthCheckParams {
	trigger_type?: string;
	trigger_source?: string;
	timeout_minutes?: number;
	include_unit_tests?: boolean;
	include_performance_tests?: boolean;
	include_integration_tests?: boolean;
	worker_filters?: string[];
}

export interface InitiateHealthCheckResponse {
	ok: boolean;
	result: {
		health_check_uuid: string;
		status: string;
		total_workers: number;
		message: string;
	};
}

// Analytics API Types
export interface AnalyticsTrendsDataPoint {
	timestamp: string;
	value: number;
	change?: number;
	changePercent?: number;
}

export interface AnalyticsTrendsSummary {
	total: number;
	average: number;
	min: number;
	max: number;
	trend: 'increasing' | 'decreasing' | 'stable';
	changePercent: number;
}

export interface AnalyticsTrendsResponse {
	ok: boolean;
	result: {
		metric: string;
		timeframe: string;
		interval: string;
		dataPoints: AnalyticsTrendsDataPoint[];
		summary: AnalyticsTrendsSummary;
	};
}

export interface AnalyticsTrendsParams {
	metric: 'events' | 'success_rate' | 'avg_duration' | 'error_rate';
	timeframe?: '1h' | '24h' | '7d' | '30d' | '90d';
	interval?: '1m' | '5m' | '15m' | '1h' | '1d';
	eventTypes?: string;
	patchIds?: string;
}

export type { AIModels } from 'worker/agents/inferutils/config.types';
// Model selection types
export type ModelSelectionMode = 'platform' | 'byok' | 'custom';

// Match chat FileType interface
export interface FileType {
	filePath: string;
	fileContents: string;
	explanation?: string;
	isGenerating?: boolean;
	needsFixing?: boolean;
	hasErrors?: boolean;
	language?: string;
}

// Streaming response wrapper types for agent session creation
export interface StreamingResponse {
  success: boolean;
  stream: Response;
}

export type AgentStreamingResponse = StreamingResponse;

export {
	type ImageAttachment, 
	isSupportedImageType, 
	MAX_IMAGE_SIZE_BYTES,
	MAX_IMAGES_PER_MESSAGE,
	SUPPORTED_IMAGE_MIME_TYPES
} from 'worker/types/image-attachment';

// Auth types imported from worker
export type { 
  AuthSession, 
  ApiKeyInfo, 
  AuthResult, 
  AuthUser,
  OAuthProvider 
} from 'worker/types/auth-types';
export type { 
  SessionResponse 
} from 'worker/utils/authUtils';

// Auth API Response Types (using existing worker types)
export type LoginResponseData = SessionResponse;

export type RegisterResponseData = SessionResponse & {
  requiresVerification?: boolean;
};

export type ProfileResponseData = {
  user: AuthUser;
  sessionId: string;
};

export interface AuthProvidersResponseData {
  providers: {
    google: boolean;
    github: boolean;
    email: boolean;
  };
  hasOAuth: boolean;
  requiresEmailAuth: boolean;
  csrfToken?: string;
  csrfExpiresIn?: number;
}

export interface CsrfTokenResponseData {
  token: string;
  headerName: string;
  expiresIn?: number;
}

// Active Sessions Response - matches getUserSessions + isCurrent from controller
export interface ActiveSessionsData {
  sessions: Array<{
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    lastActivity: Date;
    createdAt: Date;
    isCurrent: boolean;
  }>;
}

// API Keys Response - matches controller response format
export interface ApiKeysData {
  keys: Array<{
    id: string;
    name: string;
    keyPreview: string;
    createdAt: Date | null;
    lastUsed: Date | null;
    isActive: boolean;
  }>;
}

export type {
    GitHubExportOptions,
    GitHubExportResult,
} from 'worker/services/github/types';
