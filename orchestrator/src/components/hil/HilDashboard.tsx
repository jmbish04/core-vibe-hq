/**
 * HIL (Human-in-the-Loop) Dashboard Component
 *
 * Provides a comprehensive interface for managing HIL requests:
 * - List all pending HIL requests with filtering and sorting
 * - Quick response templates for common scenarios
 * - Bulk operations for efficient processing
 * - Real-time status updates
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useHilRequests, useHilRequest } from '@/hooks/useHilRequests';
import { Clock, AlertTriangle, CheckCircle, MessageSquare, Filter, Search, RefreshCw } from 'lucide-react';
import type { HilRequest } from '@/hooks/useHilRequests';

interface HilDashboardProps {
  className?: string;
}

interface QuickResponse {
  id: string;
  label: string;
  template: string;
  category: 'clarification' | 'guidance' | 'approval' | 'escalation';
}

const QUICK_RESPONSES: QuickResponse[] = [
  {
    id: 'provide-context',
    label: 'Provide Additional Context',
    template: 'I need more context about the specific requirements. Could you provide details about the expected behavior or constraints?',
    category: 'clarification'
  },
  {
    id: 'implementation-guidance',
    label: 'Implementation Guidance',
    template: 'Based on the project patterns, I recommend implementing this using [specific approach]. This aligns with our existing codebase structure.',
    category: 'guidance'
  },
  {
    id: 'standard-approach',
    label: 'Standard Approach',
    template: 'Following our established patterns, this should be implemented using [standard library/component]. This ensures consistency with the rest of the codebase.',
    category: 'guidance'
  },
  {
    id: 'requires-review',
    label: 'Requires Architecture Review',
    template: 'This change impacts multiple systems and requires architecture team review. Please provide justification for this approach.',
    category: 'approval'
  },
  {
    id: 'security-concern',
    label: 'Security Review Required',
    template: 'This implementation has security implications and requires review by the security team before proceeding.',
    category: 'escalation'
  },
  {
    id: 'complex-requirement',
    label: 'Complex Requirements',
    template: 'The requirements are complex and need clarification. Could you break this down into specific, actionable items?',
    category: 'clarification'
  }
];

export function HilDashboard({ className }: HilDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<HilRequest | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { requests, loading, error, refetch } = useHilRequests({
    status: statusFilter,
    autoRefresh: true,
    refreshInterval: 30000
  });

  const { submitResponse } = useHilRequest(selectedRequest?.id || null);

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    return requests
      .filter(request => {
        const matchesSearch = searchTerm === '' ||
          request.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          request.order_id.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
      })
      .sort((a, b) => {
        // Sort by priority: pending first, then by creation time (newest first)
        if (a.status !== b.status) {
          const priorityOrder = { pending: 0, in_progress: 1, resolved: 2, cancelled: 3 };
          return priorityOrder[a.status as keyof typeof priorityOrder] - priorityOrder[b.status as keyof typeof priorityOrder];
        }
        return b.created_at - a.created_at;
      });
  }, [requests, searchTerm]);

  const handleQuickResponse = (response: QuickResponse) => {
    setResponseText(response.template);
  };

  const handleSubmitResponse = async () => {
    if (!selectedRequest || !responseText.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await submitResponse(responseText.trim());
      if (result.ok) {
        setSelectedRequest(null);
        setResponseText('');
        refetch(); // Refresh the list
      } else {
        console.error('Failed to submit response:', result.error);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled': return <MessageSquare className="w-4 h-4 text-gray-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'in_progress': return 'default';
      case 'resolved': return 'secondary';
      case 'cancelled': return 'outline';
      default: return 'outline';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading && requests.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading HIL requests...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load HIL requests: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            HIL Requests Dashboard
          </span>
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-yellow-50 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-800">
                {requests.filter(r => r.status === 'pending').length}
              </span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">Pending</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-800">
                {requests.filter(r => r.status === 'in_progress').length}
              </span>
            </div>
            <p className="text-sm text-blue-600 mt-1">In Progress</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800">
                {requests.filter(r => r.status === 'resolved').length}
              </span>
            </div>
            <p className="text-sm text-green-600 mt-1">Resolved</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-800">
                {requests.filter(r => r.status === 'cancelled').length}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">Cancelled</p>
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No HIL requests found matching your filters.
            </div>
          ) : (
            filteredRequests.map((request) => (
              <Card key={request.id} className="border-l-4 border-l-yellow-400">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(request.status)}
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {request.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {formatTimeAgo(request.created_at)}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        Order: {request.order_id}
                      </h3>
                      <p className="text-gray-700 mb-3">{request.question}</p>
                      {request.context && (
                        <details className="mb-3">
                          <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                            Context Details
                          </summary>
                          <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
                            {JSON.stringify(JSON.parse(request.context), null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="ml-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            Respond
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Respond to HIL Request</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Question:</h4>
                              <p className="text-gray-700 p-3 bg-gray-50 rounded">
                                {request.question}
                              </p>
                            </div>

                            {/* Quick Responses */}
                            <div>
                              <h4 className="font-medium mb-2">Quick Responses:</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {QUICK_RESPONSES.map((response) => (
                                  <Button
                                    key={response.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickResponse(response)}
                                    className="text-left h-auto p-2"
                                  >
                                    <div>
                                      <div className="font-medium text-xs">{response.label}</div>
                                      <Badge variant="secondary" className="text-xs mt-1">
                                        {response.category}
                                      </Badge>
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block font-medium mb-2">Your Response:</label>
                              <Textarea
                                value={responseText}
                                onChange={(e) => setResponseText(e.target.value)}
                                placeholder="Provide your response to this HIL request..."
                                rows={6}
                              />
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={handleSubmitResponse}
                                disabled={!responseText.trim() || isSubmitting}
                              >
                                {isSubmitting ? 'Submitting...' : 'Submit Response'}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
