import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Input component with consistent padding, focus states, and dark mode support
 * Uses design tokens for focus ring styling and maintains accessibility standards
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm transition-all duration-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950 dark:focus-visible:border-blue-400',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
