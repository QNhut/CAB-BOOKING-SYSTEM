import React from 'react';

const ProfileActionSheet = ({ isOpen, title, subtitle, onClose, children, footer }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Đóng chi tiết"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      />

      <div className="relative w-full flex flex-col rounded-t-[28px] bg-white dark:bg-slate-900 shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-hidden">
        <div className="mx-auto mt-3 h-1.5 w-14 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />

        <div className="flex flex-shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>

        {footer && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileActionSheet;