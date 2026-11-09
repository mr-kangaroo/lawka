'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useShift } from '@/store/shift'

/** Small "Demo" menu in the header: reload the demo shift or start an empty one (spec §4.8). */
export function DemoMenu() {
  const loadDemo = useShift((s) => s.loadDemo)
  const newShift = useShift((s) => s.newShift)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 px-2.5 text-[13px] text-muted-foreground sm:h-8">
          Demo
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem onSelect={loadDemo}>Załaduj ponownie</DropdownMenuItem>
        <DropdownMenuItem onSelect={newShift}>Pusta zmiana</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
