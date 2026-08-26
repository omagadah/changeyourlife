// api/_text.js - Normalisation du texte produit par les modeles.
//
// LE SOULIGNE DU NOM EST VOLONTAIRE : Vercel transforme chaque fichier de /api
// en route, SAUF ceux prefixes par « _ ». Sans lui, /api/_text repondrait, et
// repondrait mal - ce module exporte des fonctions, pas un handler. Ne pas le
// renommer sans le deplacer hors de /api.
//
// POURQUOI CE FICHIER EXISTE
// « Pas de tiret long » est une regle de projet non negociable (HISTORIQUE.md).
// Elle etait ecrite dans les prompts de cyl-brief et de chat... et un tiret long
// s'affichait quand meme en production, dans un bloc d'observation de CYL.
//
// La raison : dans cyl-brief la regle vivait au milieu de la section STYLE,
// juste apres deux puces qui parlent nommement de « brief » et de « profile ».
// Le modele l'a appliquee a ces deux champs et pas aux « insights ».
//
// Une consigne de prompt est une DEMANDE. Ce fichier est la GARANTIE : quoi que
// reponde le modele, ce qui sort de l'API respecte la regle. Les deux se
// completent - on garde la consigne (elle evite au modele de construire une
// phrase qui repose sur le tiret) et on nettoie derriere.

// U+2014 (em dash) et U+2013 (en dash) -> trait d'union.
// U+2212 (signe moins) est laisse tel quel : c'est un caractere mathematique.
const DASHES = /[—–]/g;

/** Normalise une chaine : tirets longs remplaces, espaces fines avalees. */
function cleanText(value) {
  if (value == null) return '';
  return String(value)
    // « mot — mot » et « mot – mot » deviennent « mot - mot ».
    .replace(DASHES, '-')
    // Une espace fine insecable collee au tiret laisse un double espace visible.
    .replace(/ -| -/g, ' -')
    .replace(/- |- /g, '- ')
    .replace(/ {2,}/g, ' ');
}

/**
 * Applique cleanText a toutes les chaines d'une structure (objet, tableau,
 * chaine), en profondeur. Les autres types sont renvoyes intacts.
 * Profondeur bornee : une reponse de modele est plate, et une borne evite
 * qu'une structure cyclique inattendue fasse tourner la fonction sans fin.
 */
function cleanDeep(value, depth = 0) {
  if (depth > 6) return value;
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.map((v) => cleanDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanDeep(v, depth + 1);
    return out;
  }
  return value;
}

module.exports = { cleanText, cleanDeep };
