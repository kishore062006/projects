import React, { useMemo, useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { API_BASE } from '../lib/api';
import type { AuthUser } from '../App';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AIChatbotProps = {
  user: AuthUser;
};

const makeMessageId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export function AIChatbot({ user }: AIChatbotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeMessageId(),
      role: 'assistant',
      content: `Hi ${user.name.split(' ')[0] || 'there'}! I can help with reporting issues, dashboard stats, rewards, and how this platform works.`,
    },
  ]);

  const endpoint = useMemo(() => `${API_BASE || ''}/api/chatbot`, []);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: makeMessageId(),
      role: 'user',
      content: prompt,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          history: nextMessages.slice(-8).map(({ role, content }) => ({ role, content })),
          userContext: {
            name: user.name,
            role: user.role,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      const replyText =
        typeof payload?.reply === 'string' && payload.reply.trim()
          ? payload.reply.trim()
          : 'I could not generate a response right now. Please try again in a moment.';

      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: 'assistant',
          content: replyText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: makeMessageId(),
          role: 'assistant',
          content: 'Network error while contacting AI service. Please check your connection and retry.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[min(92vw,360px)] h-[460px] rounded-2xl border border-emerald-400/30 bg-[#0b0f0d]/95 shadow-2xl backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-400/20 bg-[#101b14]">
            <div className="flex items-center gap-2 text-emerald-300">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">EcoSync AI Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-300 hover:text-white transition"
              aria-label="Close AI chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-[360px] overflow-y-auto px-3 py-3 space-y-2 bg-[#070b09]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-emerald-500 text-black'
                    : 'mr-auto bg-zinc-800 text-zinc-100'
                }`}
              >
                {message.content}
              </div>
            ))}
            {isLoading ? (
              <div className="mr-auto bg-zinc-800 text-zinc-100 rounded-xl px-3 py-2 text-sm">
                Thinking...
              </div>
            ) : null}
          </div>

          <div className="p-3 border-t border-emerald-400/20 bg-[#101b14] flex items-center gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask about reports, rewards, or actions..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-emerald-500 text-black px-3 py-2 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="h-14 w-14 rounded-full bg-emerald-500 text-black shadow-lg hover:scale-105 transition-transform grid place-items-center"
        aria-label="Open AI chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
