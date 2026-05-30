/**
 * Shared agent avatar component.
 * Renders uploaded image, preset cartoon avatar, or legacy emoji text.
 */

import { DEFAULT_AGENT_AVATAR, getAgentAvatarSrc } from './agentAvatarPresets';
import { cn } from '@/lib/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const ICON_SIZE: Record<AvatarSize, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
};

const IMAGE_SIZE: Record<AvatarSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-full w-full',
};

const EMOJI_SIZE: Record<AvatarSize, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
};

export default function AgentAvatar({
  avatar,
  size = 'md',
  className,
  imgSrc,
}: {
  avatar?: string;
  size?: AvatarSize;
  className?: string;
  imgSrc?: string;
}) {
  // Explicit image override (e.g. Abu mascot PNG)
  if (imgSrc) {
    const imgSize = size === 'xl' ? 'w-full h-full' : ICON_SIZE[size];
    return (
      <img
        src={imgSrc}
        alt="Avatar"
        className={cn(imgSize, 'rounded-full object-cover', className)}
      />
    );
  }

  const imageSrc = getAgentAvatarSrc(avatar || DEFAULT_AGENT_AVATAR);
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt="Avatar"
        className={cn(IMAGE_SIZE[size], 'rounded-full object-cover', className)}
      />
    );
  }

  // Legacy emoji string → render as text
  if (avatar) {
    return (
      <span className={cn(EMOJI_SIZE[size], 'select-none', className)}>
        {avatar}
      </span>
    );
  }

  return null;
}
