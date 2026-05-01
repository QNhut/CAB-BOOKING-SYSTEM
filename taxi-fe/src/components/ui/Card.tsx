type Props = {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
};

export function Card({ children, className = "", padding = true }: Props) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${padding ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}
