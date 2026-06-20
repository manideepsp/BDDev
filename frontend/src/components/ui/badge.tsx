import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-primary/10 text-primary border border-primary/20',
        secondary:   'bg-secondary text-secondary-foreground border border-border',
        success:     'bg-success-subtle text-success border border-success/20',
        warning:     'bg-warning-subtle text-warning-foreground border border-warning/30',
        danger:      'bg-danger-subtle text-danger border border-danger/20',
        outline:     'border border-border text-foreground bg-transparent',
        muted:       'bg-muted text-muted-foreground border border-transparent',
        ghost:       'bg-transparent text-muted-foreground border border-transparent',
        // confidence
        high:        'bg-success-subtle text-success border border-success/20',
        medium:      'bg-warning-subtle text-amber-700 border border-warning/30',
        low:         'bg-danger-subtle text-danger border border-danger/20',
        // pipeline
        complete:    'bg-success-subtle text-success border border-success/20',
        active:      'bg-primary/10 text-primary border border-primary/20',
        failed:      'bg-danger-subtle text-danger border border-danger/20',
        pending:     'bg-muted text-muted-foreground border border-border',
      },
      size: {
        default: 'text-xs px-2.5 py-0.5',
        sm: 'text-[10px] px-2 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
