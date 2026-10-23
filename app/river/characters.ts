export type RiverCharacter = 'alexx' | 'bv';

export function riverCharacterForIdentity(userId: string | null): RiverCharacter {
  return userId === 'bv' ? 'bv' : 'alexx';
}

export const riverCharacters = {
  alexx: { name: 'Alexx', model: '/models/river-alexx-v3.glb?motion=6', scale: 1.25 },
  bv: { name: 'BV', model: '/models/river-bv-v3.glb?motion=6', scale: 1.25 },
} as const;
