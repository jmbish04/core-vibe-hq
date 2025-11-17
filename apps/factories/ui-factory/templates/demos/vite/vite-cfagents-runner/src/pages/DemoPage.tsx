/**
 * Simple AI Chat, Use it to understand how AI chat works.
 * This is a **Dummy homepage**. Make sure to rewrite it for your application. You may use the components and styles.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, Trash2, Bot, User, Clock, Wrench, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {Card} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chatService, formatTime, renderToolCall, generateSessionTitle, MODELS } from '../lib/chat';
import type { ChatState, SessionInfo } from '../../worker/types';
import { AppLayout } from '@/components/layout/AppLayout';


export function DemoPage() { // Don't touch this exporting, Its a named export
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    sessionId: chatService.getSessionId(),
    isProcessing: false,
    model: 'google-ai-studio/gemini-2.0-flash',
    streamingMessage: ''
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [hasUnsavedSession, setHasUnsavedSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages, chatState.streamingMessage]);

  // Track if current session has unsaved messages
  useEffect(() => {
    const currentSession = sessions.find(s => s.id === chatState.sessionId);
    setHasUnsavedSession(chatState.messages.length > 0 && !currentSession);
  }, [chatState.messages, chatState.sessionId, sessions]);

  const loadCurrentSession = useCallback(async () => {
    const response = await chatService.getMessages();
    if (response.success && response.data) {
      setChatState(prev => ({
        ...prev,
        ...response.data,
        sessionId: chatService.getSessionId() // Ensure sessionId is synced
      }));
    }
  }, []);

  const loadSessions = useCallback(async () => {
    const response = await chatService.listSessions();
    if (response.success && response.data) {
      setSessions(response.data);
    }
  }, []);

  const initializeApp = useCallback(async () => {
    await Promise.all([loadCurrentSession(), loadSessions()]);
  }, [loadCurrentSession, loadSessions]);

  // Initialize app - load current session and session list
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    setIsLoading(true);
    
    // Immediately add user message to chat state for instant display
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: Date.now()
    };
    
    setChatState(prev => ({ 
      ...prev, 
      messages: [...prev.messages, userMessage],
      streamingMessage: '' 
    }));

    // Auto-save session with first user message as title
    if (hasUnsavedSession && chatState.messages.length === 0) {
      const title = generateSessionTitle(message);
      await chatService.createSession(title, chatState.sessionId, message);
      await loadSessions(); // Refresh session list
    }

    const response = await chatService.sendMessage(message, chatState.model, (chunk) => {
      setChatState(prev => ({
        ...prev,
        streamingMessage: (prev.streamingMessage || '') + chunk
      }));
    });
    
    if (response.success) {
      await loadCurrentSession();
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = async () => {
    const response = await chatService.clearMessages();
    if (response.success && response.data) {
      setChatState(prev => ({ ...prev, ...response.data }));
    }
  };

  const handleModelChange = async (model: string) => {
    const response = await chatService.updateModel(model);
    if (response.success && response.data) {
      setChatState(prev => ({ ...prev, ...response.data }));
    }
  };

  // Save current session if it has unsaved messages
  const saveCurrentSessionIfNeeded = async () => {
    if (hasUnsavedSession) {
      const firstUserMessage = chatState.messages.find(m => m.role === 'user');
      const title = generateSessionTitle(firstUserMessage?.content);
      await chatService.createSession(title, chatState.sessionId, firstUserMessage?.content);
    }
  };

  const handleNewSession = async () => {
    // Save current session if needed
    await saveCurrentSessionIfNeeded();

    // Create new session
    chatService.newSession();
    setChatState({
      messages: [],
      sessionId: chatService.getSessionId(),
      isProcessing: false,
      model: chatState.model,
      streamingMessage: ''
    });
    
    await loadSessions();
  };

  const handleSwitchSession = async (sessionId: string) => {
    // Save current session if needed before switching
    await saveCurrentSessionIfNeeded();
    
    // Switch to selected session
    chatService.switchSession(sessionId);
    setChatState(prev => ({
      ...prev,
      sessionId: sessionId,
      messages: [],
      streamingMessage: '',
      isProcessing: false
    }));
    
    // Load the selected session's messages
    await loadCurrentSession();
    await loadSessions();
  };

  const handleClearAllSessions = async () => {
    const response = await chatService.clearAllSessions();
    if (response.success) {
      await loadSessions();
      // Start fresh session after clearing all
      handleNewSession();
    }
  };

  return (
    <AppLayout>
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 overflow-hidden">
      <Button 
        onClick={() => setIsDark(!isDark)} 
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-2xl hover:scale-110 hover:rotate-12 transition-all duration-200 active:scale-90 z-50"
      >
        {isDark ? '☀️' : '🌙'}
      </Button>

      <div className="absolute inset-0 bg-gradient-rainbow opacity-10 dark:opacity-20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center space-y-6 relative z-10 mb-8"
      >
        <div className="flex justify-center">
          <motion.div 
            className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary"
            animate={{ y: [-4, 4, -4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
          </motion.div>
        </div>

        <h1 className="text-5xl md:text-7xl font-display font-bold text-balance leading-tight">
          Creating your <span className="text-gradient">app</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto text-pretty">
          We are building your app, powered by Cloudflare Agents SDK
        </p>
      </motion.div>
      
      <Card className="max-w-4xl mx-auto h-[60vh] flex flex-col relative z-10 backdrop-blur-xl bg-white/10 dark:bg-black/20 border-white/20 shadow-2xl">
        <div className="p-4 border-b flex items-center gap-4">
          <motion.div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </motion.div>
          <h2 className="font-display font-bold text-xl">Mini Orange</h2>
          
          <Button onClick={() => setShowSessions(!showSessions)} variant="outline" size="sm">
            Sessions ({sessions.length}){hasUnsavedSession && ' •'}
          </Button>
          
          {showSessions && (
            <div className="flex items-center gap-2">
              <Select value={chatState.sessionId} onValueChange={handleSwitchSession}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sessions.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearAllSessions}
                  title="Clear all sessions"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          <Select value={chatState.model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleNewSession} title="New session">
              New Chat
            </Button>
            <Button variant="outline" size="icon" onClick={handleClear} title="Clear conversation">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatState.messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Until we are ready, Why not talk to me? Try asking about:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <Badge variant="secondary">Weather in London</Badge>
                <Badge variant="secondary">Search for Claude AI news</Badge>
                <Badge variant="secondary">Browse https://anthropic.com</Badge>
                <Badge variant="secondary">What tools do you have?</Badge>
              </div>
            </div>
          )}
          
          {chatState.messages.map((msg) => (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-3 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="text-xs opacity-70">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                
                <p className="whitespace-pre-wrap mb-2">{msg.content}</p>
                
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <div className="flex items-center gap-1 mb-2 text-xs opacity-70">
                      <Wrench className="w-3 h-3" />
                      Tools used:
                    </div>
                    {msg.toolCalls.map((tool, idx) => (
                      <Badge key={idx} variant="outline" className="mr-1 mb-1 text-xs">
                        {renderToolCall(tool)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          
          {chatState.streamingMessage && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-2xl max-w-[80%]">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-4 h-4" />
                  <span className="text-xs opacity-70">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Now
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{chatState.streamingMessage}<span className="animate-pulse">|</span></p>
              </div>
            </div>
          )}

          {(isLoading || chatState.isProcessing) && !chatState.streamingMessage && (
            <div className="flex justify-start">
              <div className="bg-muted p-3 rounded-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-4 h-4" />
                  <span className="text-xs opacity-70">Thinking...</span>
                </div>
                <div className="flex space-x-1">
                  {[0, 1, 2].map(i => (
                    <div 
                      key={i} 
                      className="w-2 h-2 bg-current rounded-full animate-pulse" 
                      style={{animationDelay: `${i * 100}ms`}} 
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chat with me"
              className="flex-1 min-h-[42px] max-h-32 resize-none leading-tight py-3"
              rows={1}
              disabled={isLoading || chatState.isProcessing}
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading || chatState.isProcessing}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </Card>
    </main>
  </AppLayout>
);
}