'use client'

import { cn } from 'cn'
import { type ReactNode, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Plain inline text with a 1 px dashed underline; amber when the value is missing or estimated. */
const VALUE =
  'relative inline cursor-pointer rounded-none border-0 border-b border-dashed bg-transparent p-0 text-left leading-[1.4] outline-none transition-colors focus-visible:rounded-xs focus-visible:ring-3 focus-visible:ring-ring/50 max-sm:before:absolute max-sm:before:-inset-x-1 max-sm:before:-inset-y-3'
const TONE = {
  default: 'border-foreground/30 text-foreground hover:border-foreground/70 aria-expanded:border-foreground/70',
  required: 'border-required-border text-required hover:border-required aria-expanded:border-required',
}

export type InlineFieldProps = {
  /** Accessible name, e.g. "Typ zdarzenia: Bójka". */
  label: string
  /** The shown value; `null` shows the amber `placeholder`. */
  value: ReactNode | null
  placeholder: string
  /** Shows the placeholder like a dimmed value ("00:00" at 60%) instead of a word. */
  placeholderAsValue?: boolean
  /** Amber even with a value (an estimated time). */
  required?: boolean
  bold?: boolean
  /** Explanation shown on hover and focus (field gaps). */
  tooltip?: string
  readOnly: boolean
  open: boolean
  onOpenChange(open: boolean): void
  /** The picker shown in the popover. */
  children: ReactNode
  contentClassName?: string
}

/**
 * One value of an incident header line (type, time or place). Clicking it opens its picker in
 * a popover. Read-only: plain text, and "brak danych" in amber for a missing value.
 */
export function InlineField({
  label,
  value,
  placeholder,
  placeholderAsValue,
  required,
  bold,
  tooltip,
  readOnly,
  open,
  onOpenChange,
  children,
  contentClassName,
}: InlineFieldProps) {
  const [tipOpen, setTipOpen] = useState(false)
  const amber = value === null || !!required

  if (readOnly) {
    const text = (
      <span className={cn(bold && value !== null && 'font-semibold', amber ? 'text-required' : 'text-foreground')}>
        {value ?? 'brak danych'}
      </span>
    )
    if (!tooltip || value === null) return text
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={label} className="rounded-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-60 text-[13px] leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }

  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={label}
        className={cn(VALUE, TONE[amber ? 'required' : 'default'], bold && 'font-semibold')}
      >
        {value ?? (placeholderAsValue ? <span className="opacity-60">{placeholder}</span> : placeholder)}
      </button>
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {tooltip ? (
        <Tooltip open={tipOpen && !open} onOpenChange={setTipOpen}>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-60 text-[13px] leading-snug">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent align="start" collisionPadding={12} className={cn('w-72 gap-0 p-0', contentClassName)}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
