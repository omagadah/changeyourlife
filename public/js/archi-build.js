// /js/archi-build.js - Univers ARCHITECTURE : une tour 3D procédurale et élégante
// (verre sombre + néons), alternative à l'arbre. Même métaphore : elle s'élève au
// fil de la progression. Construite avec des primitives Three (léger, no asset).

export function buildArchi(THREE, opts = {}) {
  const growth = Math.max(0, Math.min(1, (typeof opts.growth === 'number') ? opts.growth : 1));
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x10233b, metalness: 0.65, roughness: 0.22, emissive: 0x0a1830, emissiveIntensity: 0.45 });
  const neon = new THREE.MeshStandardMaterial({ color: 0x7fd1ff, emissive: 0x3fa9ff, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.2 });
  const warm = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb968, emissiveIntensity: 1.1, roughness: 0.5 });

  const FLOORS = Math.max(2, Math.round(2 + growth * 12)), FH = 5.6;   // s'élève avec l'XP (2 -> 14 étages)
  let y = 0;
  for (let i = 0; i < FLOORS; i++) {
    const t = i / FLOORS;
    const w = 26 * (1 - t * 0.55);           // s'affine vers le haut
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, FH, w), glass);
    floor.position.y = y + FH / 2;
    floor.rotation.y = i * 0.1;               // légère torsion (gratte-ciel torsadé)
    g.add(floor);
    // bandeau lumineux entre étages
    const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.03, 0.5, w * 1.03), (i % 3 === 0 ? warm : neon));
    band.position.y = y + FH; band.rotation.y = floor.rotation.y;
    g.add(band);
    // arêtes verticales lumineuses (4 coins) un étage sur deux
    if (i % 2 === 0) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, FH, 0.4), neon);
        edge.position.set(sx * w / 2, y + FH / 2, sz * w / 2);
        edge.rotation.y = floor.rotation.y;
        g.add(edge);
      }
    }
    y += FH;
  }
  // flèche / antenne au sommet
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.4, 14, 8), neon);
  spire.position.y = y + 7; g.add(spire);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), warm);
  tip.position.y = y + 14.5; g.add(tip);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
