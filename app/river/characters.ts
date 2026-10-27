export type RiverCharacter = 'alexx' | 'bv';

export function riverCharacterForIdentity(userId: string | null): RiverCharacter {
  return userId === 'bv' ? 'bv' : 'alexx';
}

export const riverCharacters = {
  alexx: { name: 'Alexx', model: '/models/river-alexx-anime-v1.vrm', scale: 1.25 },
  bv: { name: 'BV', model: '/models/river-bv-anime-v1.vrm', scale: 1.25 },
} as const;
