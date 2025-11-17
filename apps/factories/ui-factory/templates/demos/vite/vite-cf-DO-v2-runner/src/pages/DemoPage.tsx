import { useEffect, useMemo, useState, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster, toast } from '@/components/ui/sonner'
import type { User, Chat, ChatMessage } from '@shared/types'
import { api } from '@/lib/api-client'
import { AppLayout } from '@/components/layout/AppLayout'

export function DemoPage() {
  // Minimal state — small demo for AI to extend
  const [users, updateUsers] = useState<User[]>([])
  const [chats, updateChats] = useState<Chat[]>([])
  const [messages, updateMessages] = useState<ChatMessage[]>([])
  const [selectedUserId, chooseUserId] = useState<string>('')
  const [selectedChatId, chooseChatId] = useState<string>('')
  const [name, updateName] = useState('')
  const [title, updateTitle] = useState('')
  const [text, updateText] = useState('')

  const usersById = useMemo(() => new Map(users.map(u => [u.id, u])), [users])

  const loadBasics = useCallback(async () => {
    const [uPage, cPage] = await Promise.all([
      api<{ items: User[]; next: string | null }>('/api/users'),
      api<{ items: Chat[]; next: string | null }>('/api/chats'),
    ])
    updateUsers(uPage.items)
    updateChats(cPage.items)
  }, [])

  const loadMessages = useCallback(async (chatId: string) => {
    const m = await api<ChatMessage[]>(`/api/chats/${chatId}/messages`)
    updateMessages(m)
  }, [])

  useEffect(() => {
    loadBasics().catch(err => toast.error(err.message))
  }, [loadBasics])

  // Select first user/chat once data arrives
  useEffect(() => {
    if (!selectedUserId && users.length) chooseUserId(users[0].id)
  }, [users, selectedUserId])

  useEffect(() => {
    if (!selectedChatId && chats.length) chooseChatId(chats[0].id)
  }, [chats, selectedChatId])

  useEffect(() => {
    if (selectedChatId) loadMessages(selectedChatId).catch(err => toast.error(err.message))
  }, [selectedChatId, loadMessages])

  const createUser = useCallback(async () => {
    if (!name.trim()) return
    const u = await api<User>('/api/users', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
    updateUsers(prev => [...prev, u])
    updateName('')
    toast.success('User created')
    if (!selectedUserId) chooseUserId(u.id)
  }, [name, selectedUserId])

  const createChat = useCallback(async () => {
    if (!title.trim()) return
    const c = await api<Chat>('/api/chats', { method: 'POST', body: JSON.stringify({ title: title.trim() }) })
    updateChats(prev => [...prev, c])
    updateTitle('')
    toast.success('Chat created')
    if (!selectedChatId) chooseChatId(c.id)
  }, [title, selectedChatId])

  const send = useCallback(async () => {
    if (!selectedUserId || !selectedChatId || !text.trim()) return
    const m = await api<ChatMessage>(`/api/chats/${selectedChatId}/messages`, { method: 'POST', body: JSON.stringify({ userId: selectedUserId, text: text.trim() }) })
    updateMessages(prev => [...prev, m])
    updateText('')
  }, [selectedUserId, selectedChatId, text])

  return (
    <AppLayout>
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 overflow-hidden relative">
      <ThemeToggle />

      <div className="absolute inset-0 bg-gradient-rainbow opacity-10 dark:opacity-20" />
      
      <div className="space-y-6 relative z-10 max-w-3xl w-full">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary floating">
            <Sparkles className="w-8 h-8 text-white rotating" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-display font-bold text-center">
          Minimal Users + Chats Demo
        </h1>

        {/* Quick create controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex gap-2">
            <Input placeholder="New user name" value={name} onChange={(e) => updateName(e.target.value)} />
            <Button onClick={createUser}>Add User</Button>
          </div>
          <div className="flex gap-2">
            <Input placeholder="New chat title" value={title} onChange={(e) => updateTitle(e.target.value)} />
            <Button onClick={createChat}>Add Chat</Button>
          </div>
        </div>

        {/* Pick user and chat */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground w-20">User</label>
            <select className="w-full bg-background border px-2 py-2 rounded" value={selectedUserId} onChange={(e) => chooseUserId(e.target.value)}>
              <option value="">Select a user</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground w-20">Chat</label>
            <select className="w-full bg-background border px-2 py-2 rounded" value={selectedChatId} onChange={(e) => chooseChatId(e.target.value)}>
              <option value="">Select a chat</option>
              {chats.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="border rounded p-3 h-64 overflow-y-auto bg-muted/30">
          {selectedChatId ? (
            messages.length ? (
              messages.map(m => (
                <div key={m.id} className="text-sm mb-2">
                  <span className="font-medium">{usersById.get(m.userId)?.name ?? 'Unknown'}:</span> {m.text}
                  <span className="text-xs text-muted-foreground ml-2">{new Date(m.ts).toLocaleTimeString()}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No messages yet.</div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">Select a chat to view messages.</div>
          )}
        </div>

        {/* Compose */}
        <div className="flex gap-2">
          <Textarea placeholder="Type a message" value={text} onChange={(e) => updateText(e.target.value)} disabled={!selectedUserId || !selectedChatId} />
          <Button onClick={() => send().catch(err => toast.error(err.message))} disabled={!selectedUserId || !selectedChatId || !text.trim()}>Send</Button>
        </div>
      </div>

      <footer className="mt-8 text-center text-muted-foreground/80">
        <p>Powered by Cloudflare</p>
      </footer>

      <Toaster richColors closeButton />
    </main>
    </AppLayout>
  )
}
