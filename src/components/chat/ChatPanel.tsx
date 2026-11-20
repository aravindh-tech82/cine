import React, { useState, useRef, useEffect } from 'react';
import { useCineMate } from '../../context/CineMateContext';
import { Send, MessageSquare, X } from 'lucide-react';

export const ChatPanel: React.FC = () => {
  const {
    chatMessages,
    sendChatMessage,
    currentUser,
    isChatOpen,
    setIsChatOpen,
    unreadChatCount,
  } = useCineMate();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const quickEmojis = ['❤️', '😂', '😭', '😱', '🔥', '🥺', '🍿', '✨', '👏', '🍫'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [chatMessages, isChatOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sendChatMessage(inputText);
    setInputText('');
  };

  if (!isChatOpen) {
    return (
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-20 right-6 z-30 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white p-3.5 rounded-full shadow-2xl shadow-purple-600/40 transition-transform hover:scale-105 cursor-pointer"
        title="Open Live Chat"
      >
        <MessageSquare className="w-5 h-5" />
        {unreadChatCount > 0 && (
          <span className="w-5 h-5 bg-pink-500 border-2 border-[#0B0A10] text-[10px] font-bold rounded-full flex items-center justify-center -ml-1 animate-pulse">
            {unreadChatCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <aside className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 w-80 sm:w-88 h-[480px] glass-panel rounded-2xl border border-purple-500/25 shadow-2xl flex flex-col overflow-hidden animate-slide-up">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="font-heading font-semibold text-sm text-white">Room Chat</h3>
        </div>
        <button
          onClick={() => setIsChatOpen(false)}
          className="p-1 rounded-lg text-purple-200/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-purple-200/50 p-4">
            <span className="text-3xl mb-2">🍿</span>
            <p className="font-medium text-white text-xs">No messages yet</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Say something sweet or send your movie thoughts!
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 font-medium">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.senderId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-semibold text-purple-200/70">
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[9px] text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  className={`px-3 py-2 rounded-2xl max-w-[85%] text-xs break-words leading-relaxed ${
                    isMe
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-xs'
                      : 'bg-[#211F2B] text-gray-200 border border-white/10 rounded-bl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emojis */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-white/5 bg-black/20 overflow-x-auto no-scrollbar">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setInputText((prev) => prev + emoji)}
            className="hover:scale-125 transition-transform p-1 text-sm cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-2.5 border-t border-white/10 bg-white/[0.02] flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Whisper something..."
          className="flex-1 bg-[#12111A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-md"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
