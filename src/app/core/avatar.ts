/**
 * LocaFind's explorer avatars: cute chibi animals (original artwork), so anyone can pick
 * one without choosing a gender. Drawn as inline SVG so they work in the map sprite layer
 * and in Angular templates alike.
 */
export type Species = 'cat' | 'dog' | 'bunny' | 'bear' | 'frog' | 'fox';

export interface AvatarPreset {
  id: string;
  label: string;
  species: Species;
  fur: string;
  /** Muzzle, belly and inner-ear colour. */
  light: string;
  /** Darker accent: ear tips, stripes, nose. */
  dark: string;
  shirt: string;
  pants: string;
  bag: string;
}

export const AVATARS: AvatarPreset[] = [
  { id: 'kitty', label: 'Kitty', species: 'cat', fur: '#f5b971', light: '#fff4e3', dark: '#d9822b', shirt: '#2563eb', pants: '#1e3a8a', bag: '#facc15' },
  { id: 'pup', label: 'Pup', species: 'dog', fur: '#c98f5f', light: '#f7e3cd', dark: '#7c4a2d', shirt: '#16a34a', pants: '#14532d', bag: '#f97316' },
  { id: 'bun', label: 'Bun', species: 'bunny', fur: '#f8f6f2', light: '#fbcfe8', dark: '#d6c7bd', shirt: '#f97316', pants: '#7c2d12', bag: '#22c55e' },
  { id: 'cub', label: 'Cub', species: 'bear', fur: '#8d6243', light: '#e9cba8', dark: '#5b3a24', shirt: '#7c3aed', pants: '#3b0764', bag: '#38bdf8' },
  { id: 'hop', label: 'Hop', species: 'frog', fur: '#7fcf6b', light: '#e3f9c8', dark: '#3f8f3a', shirt: '#e11d48', pants: '#881337', bag: '#fde047' },
  { id: 'kit', label: 'Kit', species: 'fox', fur: '#ef7d32', light: '#fff7ed', dark: '#7a3410', shirt: '#0ea5e9', pants: '#0c4a6e', bag: '#a3e635' },
];

export function avatarById(id: string | null | undefined): AvatarPreset {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

// Head: centre (32, 34), radius 17.
const HX = 32;
const HY = 34;

/** Ears and other bits drawn behind the head. */
function earsBehind(p: AvatarPreset): string {
  switch (p.species) {
    case 'cat':
      return `<path d="M17 28 L19 12 L30 21 Z" fill="${p.fur}"/><path d="M47 28 L45 12 L34 21 Z" fill="${p.fur}"/>
              <path d="M20 24 L21 16 L27 21 Z" fill="${p.light}"/><path d="M44 24 L43 16 L37 21 Z" fill="${p.light}"/>`;
    case 'fox':
      return `<path d="M16 30 L17 9 L30 20 Z" fill="${p.fur}"/><path d="M48 30 L47 9 L34 20 Z" fill="${p.fur}"/>
              <path d="M17 13 L17 9 L21 12 Z" fill="${p.dark}"/><path d="M47 13 L47 9 L43 12 Z" fill="${p.dark}"/>
              <path d="M19 25 L19 15 L26 20 Z" fill="${p.light}"/><path d="M45 25 L45 15 L38 20 Z" fill="${p.light}"/>`;
    case 'bunny':
      return `<ellipse cx="24" cy="12" rx="5.5" ry="13" transform="rotate(-10 24 12)" fill="${p.fur}"/>
              <ellipse cx="40" cy="12" rx="5.5" ry="13" transform="rotate(10 40 12)" fill="${p.fur}"/>
              <ellipse cx="24" cy="13" rx="2.6" ry="9" transform="rotate(-10 24 13)" fill="${p.light}"/>
              <ellipse cx="40" cy="13" rx="2.6" ry="9" transform="rotate(10 40 13)" fill="${p.light}"/>`;
    case 'bear':
      return `<circle cx="18.5" cy="21" r="6" fill="${p.fur}"/><circle cx="45.5" cy="21" r="6" fill="${p.fur}"/>
              <circle cx="18.5" cy="21" r="3" fill="${p.light}"/><circle cx="45.5" cy="21" r="3" fill="${p.light}"/>`;
    case 'frog':
      return `<circle cx="23" cy="21" r="7" fill="${p.fur}"/><circle cx="41" cy="21" r="7" fill="${p.fur}"/>`;
    default:
      return '';
  }
}

/** Ears and markings drawn on top of the head. */
function earsFront(p: AvatarPreset): string {
  if (p.species === 'dog') {
    return `<path d="M16 26 C10 32 12 44 18 45 C21 40 21 32 22 27 Z" fill="${p.dark}"/>
            <path d="M48 26 C54 32 52 44 46 45 C43 40 43 32 42 27 Z" fill="${p.dark}"/>`;
  }
  if (p.species === 'cat') {
    return `<path d="M30 18 L32 24 L34 18" stroke="${p.dark}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  return '';
}

/** Eyes: big friendly dots; frogs get them on top bumps. */
function eyes(p: AvatarPreset): string {
  if (p.species === 'frog') {
    return `<circle cx="23" cy="21" r="4" fill="#fff"/><circle cx="41" cy="21" r="4" fill="#fff"/>
            <circle cx="23.5" cy="21.5" r="2.4" fill="#1f2937"/><circle cx="41.5" cy="21.5" r="2.4" fill="#1f2937"/>
            <circle cx="24.3" cy="20.6" r="0.8" fill="#fff"/><circle cx="42.3" cy="20.6" r="0.8" fill="#fff"/>`;
  }
  return `<ellipse cx="25.5" cy="34" rx="2.6" ry="3.1" fill="#1f2937"/><ellipse cx="38.5" cy="34" rx="2.6" ry="3.1" fill="#1f2937"/>
          <circle cx="26.4" cy="32.9" r="0.95" fill="#fff"/><circle cx="39.4" cy="32.9" r="0.95" fill="#fff"/>`;
}

function face(p: AvatarPreset): string {
  if (p.species === 'frog') {
    return `<path d="M24 40 Q32 46 40 40" stroke="#1f2937" stroke-width="1.6" fill="none" stroke-linecap="round"/>
            <ellipse cx="21" cy="40" rx="3" ry="1.8" fill="#f87171" opacity="0.5"/><ellipse cx="43" cy="40" rx="3" ry="1.8" fill="#f87171" opacity="0.5"/>`;
  }
  const muzzle = p.species === 'fox'
    ? `<path d="M22 37 Q32 50 42 37 Q37 42 32 42 Q27 42 22 37 Z" fill="${p.light}"/>`
    : `<ellipse cx="${HX}" cy="41" rx="7" ry="5" fill="${p.light}"/>`;
  const nose = p.species === 'bunny' || p.species === 'cat'
    ? `<path d="M30.4 38.6 L33.6 38.6 L32 40.4 Z" fill="#f472b6"/>`
    : `<ellipse cx="${HX}" cy="39.2" rx="2.4" ry="1.7" fill="${p.species === 'fox' ? '#1f2937' : p.dark}"/>`;
  const whiskers = p.species === 'cat'
    ? `<path d="M19 40 L25 41 M19 43 L25 42.5 M45 40 L39 41 M45 43 L39 42.5" stroke="${p.dark}" stroke-width="0.9" stroke-linecap="round"/>`
    : '';
  return `${muzzle}${nose}
    <path d="M29.5 42.4 Q32 44.4 34.5 42.4" stroke="#1f2937" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    ${whiskers}
    <ellipse cx="21.5" cy="39.5" rx="2.8" ry="1.7" fill="#f87171" opacity="0.45"/>
    <ellipse cx="42.5" cy="39.5" rx="2.8" ry="1.7" fill="#f87171" opacity="0.45"/>`;
}

/** Full-body explorer. Limbs carry av-* classes so CSS can animate a walk cycle. */
export function avatarSvg(p: AvatarPreset): string {
  const tail =
    p.species === 'fox'
      ? `<path d="M42 66 C56 62 60 50 54 46 C52 54 46 58 40 60 Z" fill="${p.fur}"/><path d="M54 46 C58 49 57 54 55 56 C55 52 54 49 52 47 Z" fill="${p.light}"/>`
      : p.species === 'cat'
        ? `<path d="M42 66 C52 66 55 56 52 50" stroke="${p.fur}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : ''; // short tails (bunny, bear) can't be seen from the front
  return `<svg class="av" viewBox="0 0 64 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${tail}
  <rect class="av-leg av-leg-l" x="24" y="64" width="7.5" height="16" rx="3.7" fill="${p.pants}"/>
  <rect class="av-leg av-leg-r" x="32.5" y="64" width="7.5" height="16" rx="3.7" fill="${p.pants}"/>
  <ellipse cx="27.5" cy="81" rx="5" ry="3" fill="${p.fur}"/>
  <ellipse cx="36.5" cy="81" rx="5" ry="3" fill="${p.fur}"/>
  <rect x="22" y="50" width="20" height="14" rx="5" fill="${p.bag}"/>
  <rect class="av-arm av-arm-l" x="15.5" y="51" width="6.5" height="14" rx="3.2" fill="${p.shirt}"/>
  <rect class="av-arm av-arm-r" x="42" y="51" width="6.5" height="14" rx="3.2" fill="${p.shirt}"/>
  <circle cx="18.7" cy="65" r="3.2" fill="${p.fur}"/>
  <circle cx="45.3" cy="65" r="3.2" fill="${p.fur}"/>
  <rect x="20" y="48" width="24" height="20" rx="9" fill="${p.shirt}"/>
  <path d="M26 49 L26 66 M38 49 L38 66" stroke="${p.bag}" stroke-width="2.6" stroke-linecap="round"/>
  ${earsBehind(p)}
  <circle cx="${HX}" cy="${HY}" r="17" fill="${p.fur}"/>
  ${earsFront(p)}
  ${eyes(p)}
  ${face(p)}
</svg>`;
}

/**
 * Back view (walking away from the camera): no face, the backpack on top, and the tail
 * showing. Same limb classes so the walk cycle still animates.
 */
export function avatarBackSvg(p: AvatarPreset): string {
  const tail =
    p.species === 'fox'
      ? `<path d="M32 66 C22 70 18 82 26 88 C28 80 32 74 36 70 Z" fill="${p.fur}"/><path d="M26 88 C22 86 21 82 22 80 C24 83 25 85 27 86 Z" fill="${p.light}"/>`
      : p.species === 'cat'
        ? `<path d="M34 66 C40 72 44 64 41 58" stroke="${p.fur}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : p.species === 'bunny'
          ? `<circle cx="32" cy="67" r="4.5" fill="#fff"/>`
          : p.species === 'bear' || p.species === 'dog'
            ? `<circle cx="32" cy="67" r="3.2" fill="${p.fur}"/>`
            : '';
  const frogBumps =
    p.species === 'frog' ? `<circle cx="23" cy="21" r="7" fill="${p.fur}"/><circle cx="41" cy="21" r="7" fill="${p.fur}"/>` : '';
  return `<svg class="av" viewBox="0 0 64 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect class="av-leg av-leg-l" x="24" y="64" width="7.5" height="16" rx="3.7" fill="${p.pants}"/>
  <rect class="av-leg av-leg-r" x="32.5" y="64" width="7.5" height="16" rx="3.7" fill="${p.pants}"/>
  <ellipse cx="27.5" cy="81" rx="5" ry="3" fill="${p.fur}"/>
  <ellipse cx="36.5" cy="81" rx="5" ry="3" fill="${p.fur}"/>
  <rect class="av-arm av-arm-l" x="15.5" y="51" width="6.5" height="14" rx="3.2" fill="${p.shirt}"/>
  <rect class="av-arm av-arm-r" x="42" y="51" width="6.5" height="14" rx="3.2" fill="${p.shirt}"/>
  <circle cx="18.7" cy="65" r="3.2" fill="${p.fur}"/>
  <circle cx="45.3" cy="65" r="3.2" fill="${p.fur}"/>
  <rect x="20" y="48" width="24" height="20" rx="9" fill="${p.shirt}"/>
  ${tail}
  <rect x="21.5" y="48.5" width="21" height="17" rx="6" fill="${p.bag}"/>
  <rect x="24" y="51" width="16" height="6" rx="3" fill="#ffffff" opacity="0.35"/>
  <rect x="29" y="58.5" width="6" height="3" rx="1.5" fill="#1f2937" opacity="0.35"/>
  ${earsBehind(p)}
  ${frogBumps}
  <circle cx="${HX}" cy="${HY}" r="17" fill="${p.fur}"/>
  ${p.species === 'dog' ? earsFront(p) : ''}
  <ellipse cx="${HX}" cy="${HY + 3}" rx="9" ry="7" fill="${p.dark}" opacity="0.12"/>
</svg>`;
}

/** Head-and-shoulders crop for the portrait and the picker. */
export function avatarHeadSvg(p: AvatarPreset): string {
  return avatarSvg(p).replace('viewBox="0 0 64 96"', 'viewBox="8 6 48 48"');
}
