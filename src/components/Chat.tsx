import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { MessageSquare, Send, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Chat: React.FC = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages', auth.currentUser);
    });
    return () => unsubscribe();
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: profile.uid,
        senderName: `${profile.firstName} ${profile.lastName}`,
        content: newMessage,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className={`fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 flex flex-col transition-all ${isOpen ? 'h-[450px] w-80 md:w-96' : 'h-14 w-14'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`self-end p-4 rounded-full shadow-2xl transition-all transform active:scale-95 ${isOpen ? 'bg-secondary-dark border border-border-dark text-white' : 'bg-ukraine-blue text-white hover:scale-110'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="flex-1 mt-3 bg-card-dark border border-border-dark rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          <div className="p-4 border-b border-border-dark flex justify-between items-center bg-secondary-dark">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E0E0E0]">Загальний чат</h3>
            </div>
            <span className="text-[10px] text-text-dim font-mono tracking-tighter">MS: 16</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-ukraine-blue">ID: {msg.senderId?.slice(0, 6)}</span>
                  <span className="text-[9px] font-black text-[#E0E0E0] uppercase">{msg.senderName}:</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="p-3 bg-bg-dark border-t border-border-dark flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Напишіть щось..."
              className="flex-1 bg-secondary-dark border border-border-dark rounded-xl px-4 py-2.5 text-xs outline-none focus:border-ukraine-blue transition-all text-white placeholder:text-text-dim"
            />
            <button type="submit" className="p-3 bg-ukraine-blue text-white rounded-xl hover:bg-opacity-80 transition-all active:scale-90">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
};
