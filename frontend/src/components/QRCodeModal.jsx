import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, ExternalLink, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function QRCodeModal({ boxId, isOpen, onClose }) {
  if (!isOpen) return null;

  const verifyUrl = `${window.location.origin}/verify/${boxId}`;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
          <Smartphone className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">Physical Parcel Tag</h3>
        <p className="text-xs text-slate-400 mb-5">
          Scan this QR code with any phone camera to verify the tamper-evident cryptographic hash chain.
        </p>

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-xl inline-block shadow-lg border-2 border-emerald-500/30">
          <QRCodeSVG
            value={verifyUrl}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="mt-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 mono break-all">
          {verifyUrl}
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            to={`/verify/${boxId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <span>Open Verify Page</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

