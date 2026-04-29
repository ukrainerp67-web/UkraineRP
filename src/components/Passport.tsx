import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Calendar, Clock, BadgeCheck, Fingerprint, Copy, CheckCircle2 } from 'lucide-react';

interface PassportProps {
  uid: string;
  firstName: string;
  lastName: string;
  sex: string;
  birthDate: string;
  balance: number;
  signature: string;
  passportPhoto: string;
  isVerified?: boolean;
  onPhotoClick?: () => void;
}

export const Passport: React.FC<PassportProps> = ({
  uid,
  firstName,
  lastName,
  sex,
  birthDate,
  balance,
  signature,
  passportPhoto,
  isVerified,
  onPhotoClick
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const passportId = uid ? `UA-${uid.slice(0, 8).toUpperCase()}` : 'UA-PENDING';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(passportId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tickerText = `ЗАШИФРОВАНО • ${currentTime.toLocaleDateString('uk-UA')} • ${currentTime.toLocaleTimeString('uk-UA')} • DOCUMENT SECURED • ID ${passportId} • `;

  return (
      <motion.div 
        style={{ fontVariantNumeric: 'tabular-nums' }}
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        whileHover={{ 
          y: -10, 
          scale: 1.02, 
          boxShadow: "0 30px 60px -12px rgba(0,0,0,0.7), 0 0 20px rgba(0,102,255,0.1)" 
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 25,
          opacity: { duration: 0.5 }
        }}
        className="relative w-full aspect-[1.58/1] max-w-[520px] mx-auto bg-gradient-to-br from-[#1a1c24] to-[#0a0b10] rounded-[1rem] md:rounded-[2rem] p-3 md:p-6 lg:p-7 overflow-hidden border border-white/10 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] preserve-3d cursor-pointer"
      >
        {/* Blue & Yellow Accents */}
        <div className="absolute top-0 right-0 w-24 md:w-64 h-24 md:h-64 bg-ukraine-blue/15 blur-[60px] md:blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 md:w-64 h-24 md:h-64 bg-ukraine-yellow/10 blur-[60px] md:blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex flex-col h-full gap-2 md:gap-6 lg:gap-8">
          {/* Header */}
          <header className="flex justify-between items-start shrink-0">
            <div className="flex items-center gap-1 md:gap-4">
              <div className="w-6 h-6 md:w-14 md:h-14 bg-ukraine-blue rounded-md md:rounded-xl flex items-center justify-center shadow-lg border border-white/10 p-0.5 md:p-2.5">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/commons/9/95/Lesser_Coat_of_Arms_of_Ukraine.svg" 
                  alt="Coat of Arms"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-[8px] md:text-sm font-black uppercase tracking-[0.2em] md:tracking-[0.4em] text-white">УКРАЇНА</h1>
                <p className="text-[5px] md:text-[10px] font-black text-ukraine-blue uppercase tracking-widest leading-none">ПАСПОРТНИЙ СЕРВІС</p>
              </div>
            </div>
            <div className="text-right hidden xs:block">
              <div className="text-[6px] md:text-xs font-black text-white/20 uppercase tracking-[0.15em]">ПРИВАТНА ВЛАСНІСТЬ</div>
              <div className="text-[5px] md:text-[10px] font-bold text-ukraine-yellow mt-0.5 md:mt-1">МВС УКРАЇНИ</div>
            </div>
          </header>

          {/* Content Body */}
          <div className="flex gap-2 md:gap-8 flex-1 min-h-0">
            {/* Photo Container */}
            <div className="flex flex-col items-center gap-1 md:gap-4 shrink-0 justify-between">
              <div 
                onClick={(e) => {
                  if (onPhotoClick) {
                    e.stopPropagation();
                    onPhotoClick();
                  }
                }}
                className={`w-16 xs:w-18 md:w-40 aspect-[4/5] bg-[#2a2d3a] rounded-md md:rounded-2xl border border-white/10 overflow-hidden relative group transition-all ${onPhotoClick ? 'cursor-pointer hover:border-ukraine-blue active:scale-95' : ''}`}
              >
                {passportPhoto ? (
                   <img src={passportPhoto} alt="User" className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                ) : (
                   <div className="w-full h-full flex items-center justify-center">
                      <Fingerprint className="w-6 md:w-16 h-6 md:h-16 text-white/5" />
                   </div>
                )}
                <div className="absolute inset-0 border border-ukraine-blue opacity-20 pointer-events-none" />
                <div className="absolute bottom-1 md:bottom-2 left-1 md:left-2 right-1 md:right-2 h-0.5 bg-ukraine-blue/50 blur-[1px] md:blur-[2px]" />
                
                {onPhotoClick && (
                  <div className="absolute inset-0 bg-ukraine-blue/0 group-hover:bg-ukraine-blue/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <div className="bg-black/60 backdrop-blur-sm p-1.5 md:p-3 rounded-full border border-white/20">
                      <Clock className="w-3 md:w-6 h-3 md:h-6 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <div className="w-full h-5 md:h-12 border border-white/5 bg-white/5 rounded-sm md:rounded-lg flex items-center justify-center italic text-[7px] md:text-sm text-white/40 font-serif opacity-60 overflow-hidden truncate px-1 shrink-0">
                {signature || `${firstName} ${lastName}`}
              </div>
            </div>

            {/* Data Fields & Ticker Container */}
            <div className="flex-1 flex flex-col justify-between min-w-0 py-0">
              {/* Fields Grid */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 md:gap-y-4 flex-1">
                <DataField label="ПРІЗВИЩЕ" value={lastName.toUpperCase()} />
                <DataField 
                  label="ІМ'Я" 
                  value={firstName.toUpperCase()} 
                  addon={isVerified ? <CheckCircle2 className="w-2.5 md:w-4 h-2.5 md:h-4 text-ukraine-blue" /> : undefined}
                />
                <DataField label="ДАТА РЕЄСТРАЦІЇ" value={birthDate} />
                <DataField 
                  label="ID ДОКУМЕНТА" 
                  value={passportId} 
                  onCopy={handleCopy}
                  isCopied={copied}
                />
                <DataField label="СТАТЬ" value={sex === 'M' ? 'ЧОЛ' : 'ЖІН'} />
                <DataField label="ГРОМАДЯНСТВО" value="УКРАЇНА" isHighlight />
              </div>
              
              {/* Scrolling Ticker - Exactly opposite the signature */}
              <div className="mt-1 md:mt-4 pt-0.5 md:pt-0 border-t border-white/10 flex items-center h-5 md:h-12 shrink-0">
                <div className="flex items-center gap-1 opacity-80 mr-1.5 shrink-0">
                  <Clock className="w-2 md:w-3.5 h-2 md:h-3.5 text-ukraine-blue" />
                </div>
                <div className="relative flex-1 overflow-hidden h-3 md:h-8 flex items-center">
                  <div className="absolute inset-y-0 left-0 w-2 md:w-4 bg-gradient-to-r from-[#1a1c24] to-transparent z-10" />
                  <div className="absolute inset-y-0 right-0 w-2 md:w-4 bg-gradient-to-l from-[#1a1c24] to-transparent z-10" />
                  <motion.div 
                    key={uid}
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ 
                      duration: 25, 
                      repeat: Infinity, 
                      ease: "linear" 
                    }}
                    className="flex whitespace-nowrap"
                  >
                    <div className="flex items-center gap-8 pr-8">
                      <span className="text-[7px] md:text-[10px] font-black tracking-[0.1em] text-ukraine-blue/60 uppercase">
                        {tickerText}
                      </span>
                      <span className="text-[7px] md:text-[10px] font-black tracking-[0.1em] text-ukraine-blue/60 uppercase">
                        {tickerText}
                      </span>
                    </div>
                  </motion.div>
                </div>
                <div className="flex items-center gap-1 opacity-80 ml-1.5 shrink-0">
                  <BadgeCheck className="w-2 md:w-3.5 h-2 md:h-3.5 text-ukraine-yellow" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

const DataField = ({ label, value, isHighlight, onCopy, isCopied, addon }: { label: string, value: string, isHighlight?: boolean, onCopy?: (e: any) => void, isCopied?: boolean, addon?: React.ReactNode }) => (
  <div className="flex flex-col min-w-0 relative group/field">
    <span className="text-[6px] md:text-[8px] font-black text-text-muted uppercase tracking-widest mb-0.5 md:mb-1">{label}</span>
    <div className="flex items-center gap-2">
      <span className={`text-[10px] md:text-sm font-black uppercase tracking-tight truncate leading-none ${isHighlight ? 'text-ukraine-blue' : 'text-[#E0E0E0]'}`}>
        {value || '---'}
      </span>
      {addon}
      {onCopy && (
        <button 
          onClick={onCopy}
          className="p-1 hover:bg-white/10 rounded-md transition-colors"
          title="Копіювати"
        >
          {isCopied ? (
            <CheckCircle2 className="w-2 md:w-3.5 h-2 md:h-3.5 text-green-400" />
          ) : (
            <Copy className="w-2 md:w-3.5 h-2 md:h-3.5 text-white/20 group-hover/field:text-white/60 transition-colors" />
          )}
        </button>
      )}
    </div>
  </div>
);
