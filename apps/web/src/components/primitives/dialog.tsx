'use client';

import type { ReactNode } from 'react';
import * as RD from '@radix-ui/react-dialog';
import { cn } from '@/utils/cn';
import { IconX } from '@/components/icons';

/**
 * Radix supplies the focus trap, scroll lock, Escape handling and a unique
 * aria-labelledby per instance — all of which the hand-rolled modal lacked.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const width = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[size];
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px]" />
        <RD.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-surface p-5 shadow-xl',
            width,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RD.Title className="text-base font-semibold text-text">{title}</RD.Title>
              {description && (
                <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description>
              )}
            </div>
            <RD.Close
              aria-label="Close dialog"
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <IconX className="h-5 w-5" />
            </RD.Close>
          </div>
          {children}
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
