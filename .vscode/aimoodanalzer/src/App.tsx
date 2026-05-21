/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  BookOpen, 
  Sparkles, 
  MessageSquare, 
  Wind, 
  Coffee, 
  Moon, 
  Sun,
  X,
  Send,
  ChevronRight,
  Library
} from "lucide-react";

interface Book {
  title: string;
  author: string;
  mood_description: string;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSearch = async (e?: React.FormEvent, vibeQuery?: string) => {
    e?.preventDefault();
    const activeQuery = vibeQuery || query;
    if (!activeQuery) return;

    setLoading(true);
    try {
      const resp = await fetch("/api/mood-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: activeQuery }),
      });
      const data = await resp.json();
      setBooks(data.books || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Forgive me, the library is a bit loud today. Could you repeat that?" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const vibes = [
    { name: "Cozy Mystery", icon: <Coffee className="w-4 h-4" /> },
    { name: "Melancholic Sci-Fi", icon: <Moon className="w-4 h-4" /> },
    { name: "Wanderlust Adventure", icon: <Sun className="w-4 h-4" /> },
    { name: "Haunting Gothic", icon: <Wind className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F5F2ED] selection:bg-[#5A5A40] selection:text-white pb-20">
      {/* Header */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Library className="w-6 h-6 text-[#5A5A40]" />
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#1A1A1A]">BiblioDrift</h1>
        </div>
        <div className="hidden md:flex gap-8 font-serif italic text-sm">
          <a href="#" className="hover:text-[#5A5A40] transition-colors">The Archives</a>
          <a href="#" className="hover:text-[#5A5A40] transition-colors">Reading Rooms</a>
          <a href="#" className="hover:text-[#5A5A40] transition-colors">Librarian's Note</a>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 pt-12 md:pt-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#5A5A40] opacity-60 mb-4 block">
            Discover Your Next Chapter
          </span>
          <h2 className="text-5xl md:text-7xl font-serif leading-[1.1] mb-8">
            How do you want to <br/> 
            <span className="italic">feel</span> today?
          </h2>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto group">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Briefly describe a vibe (e.g. 'rainy noir', 'summer nostalgia')..."
                className="w-full bg-white border border-[#E5E1D8] rounded-full py-5 px-8 pr-16 text-lg focus:outline-none focus:border-[#5A5A40] focus:ring-4 focus:ring-[#5A5A40]/5 transition-all shadow-sm"
              />
              <button 
                type="submit"
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#5A5A40] text-white p-3 rounded-full hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
              >
                {loading ? <Sparkles className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </form>
          </div>

          {/* Quick Vibes */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {vibes.map((v) => (
              <button
                key={v.name}
                onClick={() => {
                  setQuery(v.name);
                  handleSearch(undefined, v.name);
                }}
                className="flex items-center gap-2 bg-white border border-[#E5E1D8] rounded-full px-5 py-2 text-sm hover:border-[#5A5A40] hover:bg-[#F5F2ED] transition-all cursor-pointer"
              >
                {v.icon}
                {v.name}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Results */}
        <section className="mt-24 text-left">
          <AnimatePresence mode="wait">
            {books.length > 0 ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid md:grid-cols-2 gap-8"
              >
                {books.map((book, idx) => (
                  <motion.div
                    key={book.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group bg-white p-8 rounded-3xl border border-[#E5E1D8] hover:border-[#5A5A40] transition-all relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <BookOpen className="w-24 h-24" />
                    </div>
                    <span className="text-[10px] font-mono opacity-40 block mb-2 uppercase tracking-widest">Archive Item 0{idx + 1}</span>
                    <h3 className="text-2xl font-serif mb-1">{book.title}</h3>
                    <p className="font-serif italic text-sm text-[#5A5A40] mb-4">by {book.author}</p>
                    <p className="text-sm leading-relaxed opacity-70 border-l-2 border-[#5A5A40]/10 pl-4">{book.mood_description}</p>
                    <button className="mt-6 text-xs uppercase tracking-widest font-bold flex items-center gap-1 hover:gap-2 transition-all p-0">
                      Read Analyst Note <ChevronRight className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            ) : query && !loading ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 opacity-30 italic font-serif"
              >
                The library is quiet... try searching for a vibe.
              </motion.div>
            ) : loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <div className="flex justify-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      className="w-2 h-2 bg-[#5A5A40] rounded-full"
                    />
                  ))}
                </div>
                <p className="mt-4 font-serif italic text-sm opacity-50">Consulting the archives...</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </main>

      {/* Floating Chat Librarian */}
      <div className="fixed bottom-8 right-8 z-50">
        <AnimatePresence>
          {isChatOpen ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-[350px] sm:w-[400px] h-[500px] rounded-[32px] overflow-hidden shadow-2xl border border-[#E5E1D8] flex flex-col mb-4"
            >
              {/* Chat Header */}
              <div className="bg-[#1A1A1A] p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5A5A40] flex items-center justify-center border border-white/20">
                    <Library className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-serif text-sm">The Librarian</h4>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-[10px] opacity-60 uppercase tracking-widest">In Residence</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                  <p className="text-center text-sm italic opacity-40 font-serif pt-10">
                    "Welcome to BiblioDrift. Is there a specific feeling you're searching for in a book today?"
                  </p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                        : 'bg-[#F5F2ED] text-[#1A1A1A] rounded-tl-none border border-[#E5E1D8]'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#F5F2ED] rounded-2xl rounded-tl-none border border-[#E5E1D8] p-4">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChat} className="p-6 pt-0">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-[#F5F2ED] border border-[#E5E1D8] rounded-2xl py-3 px-4 pr-12 text-sm focus:outline-none focus:border-[#5A5A40] transition-colors"
                  />
                  <button 
                    type="submit"
                    disabled={chatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5A40] p-2 disabled:opacity-30"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.button
              layoutId="chatBtn"
              onClick={() => setIsChatOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[#1A1A1A] text-white p-5 rounded-full shadow-2xl flex items-center justify-center group"
            >
              <MessageSquare className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              <motion.div className="overflow-hidden whitespace-nowrap px-0 group-hover:px-4 max-w-0 group-hover:max-w-[200px] transition-all duration-500">
                <span className="font-serif italic text-sm">Ask the Librarian</span>
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
