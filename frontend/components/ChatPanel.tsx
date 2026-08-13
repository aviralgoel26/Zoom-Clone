"use client";

/**
 * ChatPanel.tsx
 * -------------
 * In-meeting text chat sliding side panel.
 * Matches Zoom Workplace dark in-meeting design theme.
 */

import { useState, useRef, useEffect } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { ChatMessage } from "@/hooks/useWebRTC";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
  localDisplayName: string;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onClose,
  localDisplayName,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <aside
      id="in-meeting-chat-panel"
      aria-label="In-meeting chat"
      className="fixed right-0 top-0 bottom-0 w-80 bg-[#1C1C1E] border-l border-[#2C2C2E] flex flex-col z-30 shadow-2xl select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2C2C2E]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#0E71EB]" />
          <h2 className="text-white font-semibold text-sm">In-Meeting Chat</h2>
        </div>
        <button
          id="chat-close-btn"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors cursor-pointer"
          aria-label="Close Chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#8E8E93] p-4">
            <MessageSquare className="w-8 h-8 opacity-40 mb-2" />
            <p className="text-xs font-medium">No messages yet</p>
            <p className="text-[11px] opacity-75 mt-1">
              Send a message to start chatting with meeting participants.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.isSelf ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[11px] text-[#8E8E93]">
                <span className="font-semibold text-[#D1D1D6]">
                  {msg.isSelf ? "You" : msg.sender}
                </span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words shadow-2xs ${
                  msg.isSelf
                    ? "bg-[#0E71EB] text-white rounded-br-xs"
                    : "bg-[#2C2C2E] text-[#EBEBF5] rounded-bl-xs border border-[#3A3A3C]"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer input form */}
      <div className="p-3 border-t border-[#2C2C2E] bg-[#131314]">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            id="chat-input"
            type="text"
            placeholder="Type message here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-[#1C1C1E] border border-[#2C2C2E] focus:border-[#0E71EB] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#8E8E93] focus:outline-none transition-colors"
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-[#0E71EB] hover:bg-[#0B5EC4] disabled:opacity-40 disabled:hover:bg-[#0E71EB] text-white transition-all cursor-pointer flex-shrink-0"
            aria-label="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
