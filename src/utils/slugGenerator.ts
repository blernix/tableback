/**
 * Génère un code court unique pour les URLs de type "vanity URL"
 * Version sans NanoID pour éviter les problèmes d'import ES Module
 * 
 * @param length - Longueur du code (défaut: 8)
 * @returns Code court unique
 */
export function generateShortCode(length: number = 8): string {
  // Alphabet personnalisé : alphanumérique + tiret
  // Exclut les caractères ambigus (0, O, I, l, 1)
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz-';
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return result;
}

/**
 * Génère un slug à partir d'un nom de restaurant
 * Nettoie les caractères spéciaux, convertit en minuscules, remplace les espaces par des tirets
 * 
 * @param name - Nom du restaurant
 * @returns Slug nettoyé
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remplace les caractères spéciaux par des tirets
    .replace(/[^a-z0-9\s-]/g, '-')
    // Remplace les espaces multiples par un seul tiret
    .replace(/\s+/g, '-')
    // Remplace les tirets multiples par un seul
    .replace(/-+/g, '-')
    // Supprime les tirets au début et à la fin
    .replace(/^-+|-+$/g, '')
    // Limite à 50 caractères
    .slice(0, 50)
    // Assure qu'on a au moins 3 caractères
    .padEnd(3, 'x');
}

/**
 * Génère un slug alternatif en cas de doublon
 * 
 * @param baseSlug - Slug de base
 * @param attempt - Numéro de tentative
 * @returns Slug alternatif
 */
export function generateAlternativeSlug(baseSlug: string, attempt: number): string {
  const suffix = `-${attempt}`;
  const maxBaseLength = 50 - suffix.length;
  const truncatedBase = baseSlug.slice(0, maxBaseLength);
  return `${truncatedBase}${suffix}`;
}