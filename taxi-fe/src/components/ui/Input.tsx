import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
};

export function Input({ label, error, icon, className = "", ...props }: Props) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
        <input
          className={`
            block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5
            text-gray-900 placeholder-gray-400
            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none
            transition-colors duration-200
            disabled:bg-gray-50 disabled:text-gray-500
            ${icon ? "pl-10" : ""}
            ${error ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : ""}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
