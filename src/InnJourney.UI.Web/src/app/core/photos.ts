/**
 * Photographs the client uses for its own furniture — the hero, the city tiles —
 * hot-linked from Unsplash at the size each slot needs. Property photographs
 * come from the API, never from here.
 */
export function unsplash(id: string, width = 1600): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`;
}

export const HERO_PHOTO = '1476514525535-07fb3b4ae5f1';
export const HOST_PHOTO = '1520250497591-112f2f40a3f4';
export const STORY_PHOTOS = ['1566073771259-6a8506099945', '1611892440504-42a792e24d32'];

/** Cities the demonstration catalogue covers. Any other city uses a property's own photo. */
export const CITY_PHOTOS: Record<string, string> = {
  istanbul: '1541432901042-2d8bd64b4a9b',
  bodrum: '1507525428034-b723cf961d3e',
  edinburgh: '1506377585622-bedcbb027afc',
  tromsø: '1483347756197-71ef80e95f73',
};
