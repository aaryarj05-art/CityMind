import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const ConfirmActionModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isDestructive = false, isLoading = false }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target) && !isLoading) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy-950/80 backdrop-blur-sm"
      onClick={handleOutsideClick}
    >
      <div 
        ref={modalRef} 
        className="bg-navy-800 border border-navy-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-5 border-b border-navy-700">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${isDestructive ? 'text-red-400' : 'text-yellow-400'}`} />
            {title}
          </h2>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="p-5 border-t border-navy-700 flex justify-end gap-3 bg-navy-850">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-navy-700 hover:bg-navy-600 rounded-lg text-xs font-semibold text-white transition-colors border border-navy-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5 ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-500 border border-red-500' 
                : 'bg-blue-600 hover:bg-blue-500 border border-blue-500'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
