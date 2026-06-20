import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            {icon}
          </div>
          <input
            type={type}
            className={cn(
              'flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
