import abuDefaultImg from '@/assets/agent-avatars/abu-default.png';
import engineerImg from '@/assets/agent-avatars/engineer.png';
import productImg from '@/assets/agent-avatars/product.png';
import dataImg from '@/assets/agent-avatars/data.png';
import writerImg from '@/assets/agent-avatars/writer.png';
import businessImg from '@/assets/agent-avatars/business.png';

export const DEFAULT_AGENT_AVATAR = 'preset:abu';

export interface AgentAvatarPreset {
  key: string;
  src: string;
}

export const AGENT_AVATAR_PRESETS: AgentAvatarPreset[] = [
  { key: DEFAULT_AGENT_AVATAR, src: abuDefaultImg },
  { key: 'preset:engineer', src: engineerImg },
  { key: 'preset:product', src: productImg },
  { key: 'preset:data', src: dataImg },
  { key: 'preset:writer', src: writerImg },
  { key: 'preset:business', src: businessImg },
];

const PRESET_SRC = new Map(AGENT_AVATAR_PRESETS.map((preset) => [preset.key, preset.src]));

const LEGACY_ICON_AVATAR_MAP: Record<string, string> = {
  bot: DEFAULT_AGENT_AVATAR,
  code: 'preset:engineer',
  'clipboard-list': 'preset:product',
  'bar-chart': 'preset:data',
  'pen-line': 'preset:writer',
  users: 'preset:business',
};

export function getAgentAvatarSrc(avatar?: string): string | undefined {
  if (!avatar) return PRESET_SRC.get(DEFAULT_AGENT_AVATAR);
  if (avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;

  const normalized = LEGACY_ICON_AVATAR_MAP[avatar] ?? avatar;
  return PRESET_SRC.get(normalized);
}
