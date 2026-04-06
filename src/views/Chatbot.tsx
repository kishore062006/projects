import { FormEvent, useMemo, useState } from 'react';
import { Bot, Send, Sparkles, User, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_BASE } from '../lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

const starterPrompts = [
  'How can I report a water leakage issue properly?',
  'What should I do if my challenge progress is not updating?',
  'How do I improve my territory aura to green?',
  'Which helpline should I call for illegal dumping?',
];

export function Chatbot() {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I am your EcoSync AI assistant. Ask me about reporting issues, rewards, challenges, territory health, or helplines.',
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const sendMessage = async (text: string) => {
    const userText = text.trim();
    if (!userText || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: userText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      if (!API_BASE) {
        throw new Error('API not configured');
      }

      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      const data = (await response.json().catch(() => ({}))) as { reply?: string; message?: string };
      const assistantText = response.ok
        ? String(data.reply || '').trim() || 'I could not generate a response right now.'
        : String(data.message || 'I could not process that request right now. Please try again.');

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: assistantText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: 'I cannot reach the AI service right now. Please try again after the backend is running.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="relative flex-1 h-screen overflow-y-auto bg-[#050505] text-white p-8 md:p-12 pl-[300px] md:pl-[320px]">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-8%] h-[45vw] w-[45vw] rounded-full bg-cyan-600/10 blur-[110px]" />
        <div className="absolute bottom-[-15%] left-[8%] h-[55vw] w-[55vw] rounded-full bg-emerald-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.22em] text-zinc-300">
            <Sparkles size={14} />
            AI Session
          </p>
          <h2 className="text-4xl font-bold tracking-tight">EcoSync Chatbot</h2>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Ask anything about reporting issues, rewards, challenge progress, zone adoption, or helplines.
          </p>
        </motion.header>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
          <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="h-9 w-9 shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/20 text-cyan-200 flex items-center justify-center">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-50'
                      : 'bg-black/35 border border-white/10 text-zinc-100'
                  }`}
                >
                  {message.text}
                </div>

                {message.role === 'user' && (
                  <div className="h-9 w-9 shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/20 text-emerald-100 flex items-center justify-center">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-zinc-400 text-sm pl-1">
                <Loader2 size={16} className="animate-spin" />
                Thinking...
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage(prompt)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask EcoSync assistant..."
              className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-emerald-400/50"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-5 py-3 font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <Send size={16} />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
