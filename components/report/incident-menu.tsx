'use client'

import { cn } from 'cn'
import { CopyIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useShift } from '@/store/shift'

/** One toast id: `lastRemoved` holds a single incident, so an older toast's "Cofnij" must not linger. */
const REMOVED_TOAST = 'incident-removed'

/**
 * Right side of an incident header: "dodano o HH:MM", which turns into a ⋯ menu button on hover
 * or focus-within of the block (`group/incident`). Touch devices (no hover) always show ⋯.
 * Both share one grid cell, so swapping them never shifts the line.
 */
export function IncidentMenu({ incidentId, number, addedAt }: { incidentId: string; number: number; addedAt: string }) {
  const duplicateIncident = useShift((s) => s.duplicateIncident)
  const removeIncident = useShift((s) => s.removeIncident)
  const undoRemove = useShift((s) => s.undoRemove)
  // The menu renders in a portal, so the block loses hover and focus-within while it's open.
  const [open, setOpen] = useState(false)

  const added = `dodano o ${addedAt}`

  return (
    <div className="-my-1 grid items-center justify-items-end *:[grid-area:1/1]">
      <span
        className={cn(
          'text-xs whitespace-nowrap text-muted-foreground transition-opacity group-focus-within/incident:opacity-0 group-hover/incident:opacity-0 [@media(hover:none)]:opacity-0',
          open && 'opacity-0',
        )}
      >
        {added}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Akcje incydentu #${number}`}
            className={cn(
              'relative text-muted-foreground opacity-0 transition-opacity group-focus-within/incident:opacity-100 group-hover/incident:opacity-100 hover:text-foreground aria-expanded:text-foreground [@media(hover:none)]:opacity-100 max-sm:before:absolute max-sm:before:-inset-2',
              open && 'opacity-100',
            )}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => duplicateIncident(incidentId)} className="h-8 gap-2 px-2">
            <CopyIcon className="size-3.5" />
            Duplikuj
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="h-8 gap-2 px-2"
            onSelect={() => {
              removeIncident(incidentId)
              toast('Usunięto incydent', {
                id: REMOVED_TOAST,
                duration: 8000,
                action: { label: 'Cofnij', onClick: () => undoRemove() },
              })
            }}
          >
            <Trash2Icon className="size-3.5" />
            Usuń
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 pt-1.5 pb-1 text-xs font-normal text-muted-foreground">{added}</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
