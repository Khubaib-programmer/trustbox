import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy } from 'lucide-react';

export default function QRCodeModal({ boxId, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const verifyUrl = `${window.location.origin}/verify/${boxId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm rounded-[24px] bg-surface border border-hairline p-7 shadow-modal text-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[20px] font-semibold tracking-tight text-ink">
          Share proof of delivery
        </h3>
        <p className="mt-1 text-[14px] text-muted leading-normal">
          Anyone can scan this to check the journey of this package.
        </p>

        {/* QR Code Container */}
        <div className="my-6 p-6 rounded-2xl bg-white border border-hairline flex items-center justify-center shadow-card">
          <QRCodeSVG 
            value={verifyUrl}
            size={180}
            level="M"
            fgColor="#0A0A0A"
            bgColor="#FFFFFF"
          />
        </div>

        <div className="text-[12px] font-medium uppercase tracking-widest text-muted tabular mb-6">
          Box {boxId}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-4 rounded-[12px] bg-accent text-accent-ink hover:opacity-90 active:scale-[0.98] text-[14px] font-medium flex items-center justify-center gap-1.5 transition duration-150"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-safe" strokeWidth={2} />
                <span>Link copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" strokeWidth={1.75} />
                <span>Copy link</span>
              </>
            )}
          </button>
          
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-[12px] bg-surface hover:bg-background border border-hairline text-ink text-[14px] font-medium transition duration-150"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
