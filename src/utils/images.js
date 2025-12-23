// Centralized image imports for Vite
export const editionImages = import.meta.glob('../assets/editions/*.webp', { eager: true, import: 'default' });
export const iconImages = import.meta.glob('../assets/icons/**/*.webp', { eager: true, import: 'default' });
export const assetImages = import.meta.glob('../assets/*.webp', { eager: true, import: 'default' });

export function getEditionImage(id) {
  return editionImages[`../assets/editions/${id}.webp`];
}

export function getIconImage(id, alternate = false) {
  const path = `../assets/icons/${alternate ? 'Alternate/' : ''}${id}.webp`;
  return iconImages[path];
}

export function getAssetImage(id) {
  return assetImages[`../assets/${id}.webp`];
}
