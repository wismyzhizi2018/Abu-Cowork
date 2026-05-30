import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AgentAvatar from './AgentAvatar';
import { AGENT_AVATAR_PRESETS, DEFAULT_AGENT_AVATAR } from './agentAvatarPresets';

export default function AgentAvatarPicker({
  value,
  labels = {},
  onChange,
}: {
  value?: string;
  labels?: Record<string, string>;
  onChange: (avatar: string) => void;
}) {
  const selected = value || DEFAULT_AGENT_AVATAR;

  return (
    <TooltipProvider delayDuration={250}>
      <div className="grid grid-cols-6 gap-2">
        {AGENT_AVATAR_PRESETS.map((preset) => {
          const active = selected === preset.key;
          const label = labels[preset.key] ?? preset.key;

          return (
            <Tooltip key={preset.key}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={label}
                  aria-pressed={active}
                  title={label}
                  onClick={() => onChange(preset.key)}
                  className={cn(
                    'relative size-11 rounded-full border p-0 transition-colors',
                    active
                      ? 'border-[var(--abu-clay)] bg-[var(--abu-clay-bg)] ring-2 ring-[var(--abu-clay-ring)]'
                      : 'border-[var(--abu-border)] bg-[var(--abu-bg-base)] hover:border-[var(--abu-clay)] hover:bg-[var(--abu-bg-muted)]'
                  )}
                >
                  <AgentAvatar avatar={preset.key} size="xl" />
                  {active && (
                    <span className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--abu-clay)] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={4}>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
