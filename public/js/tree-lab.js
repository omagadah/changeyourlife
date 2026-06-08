import * as THREE from '/vendor/three/three.module.min.js';
    import { buildEzTree } from '/js/ez-tree-build.js';

    const canvas = document.getElementById('c');
    const statEl = document.getElementById('stat');
    const errEl = document.getElementById('err');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d18);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 6000);

    scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x33402e, 1.15));
    const key = new THREE.DirectionalLight(0xfff2d8, 2.0); key.position.set(50, 90, 40); scene.add(key);
    const fill = new THREE.DirectionalLight(0x88b0ff, 0.7); fill.position.set(-50, 40, -30); scene.add(fill);

    // socle translucide repere
    const baseR = 46;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(baseR, baseR*0.9, 3, 80),
      new THREE.MeshStandardMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.1, roughness: 0.3, emissive: 0x16315a, emissiveIntensity: 0.4 }));
    disc.position.y = -1.5; scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(baseR, 0.5, 12, 90),
      new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.7 }));
    ring.rotation.x = Math.PI/2; ring.position.y = 0.2; scene.add(ring);

    let tree = null;
    function load(which, growth, seed) {
      try {
        errEl.textContent = '';
        if (tree) { scene.remove(tree); tree.traverse(o => { o.geometry?.dispose?.(); }); }
        tree = buildEzTree(which, { growth, seed });
        // échelle constante (on ne force PAS une hauteur fixe) -> l'arbre grandit
        // physiquement quand la croissance augmente.
        tree.scale.setScalar(1.15);
        const b2 = new THREE.Box3().setFromObject(tree);
        tree.position.y -= b2.min.y;
        scene.add(tree);
        let v = 0; tree.traverse(o => { if (o.geometry) v += (o.geometry.attributes.position?.count || 0); });
        const usedSeed = (tree.options && tree.options.seed) ?? seed ?? '?';
        statEl.textContent = `${which} - croissance ${Math.round(growth*100)}% - graine ${usedSeed} - ${Math.round(v/1000)}k sommets`;
      } catch (e) { errEl.textContent = 'Erreur: ' + (e?.message || e); console.error(e); }
    }

    // camera orbit (360 + par-dessus, jamais sous le socle)
    const target = new THREE.Vector3(0, 48, 0);
    const st = { az: 0.6, po: 1.05, r: 150, taz: 0.6, tpo: 1.05, tr: 150 };
    const MIN_PO = 0.05, MAX_PO = 1.5, MIN_R = 60, MAX_R = 420;
    let drag = false, px = 0, py = 0;
    canvas.addEventListener('pointerdown', e => { drag = true; px = e.clientX; py = e.clientY; });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return; const dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
      const SENS = (Math.PI*0.8)/Math.max(innerWidth,320);
      st.taz -= dx*SENS; st.tpo = Math.min(MAX_PO, Math.max(MIN_PO, st.tpo - dy*SENS*0.85));
    });
    addEventListener('pointerup', () => drag = false);
    canvas.addEventListener('wheel', e => { e.preventDefault(); st.tr = Math.min(MAX_R, Math.max(MIN_R, st.tr + e.deltaY*0.0009*st.tr)); }, { passive: false });

    function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); }
    addEventListener('resize', resize); resize();

    const clock = new THREE.Clock();
    function frame() {
      const dt = Math.min(0.1, clock.getDelta());
      if (!drag) st.taz += dt*0.06;
      st.az += (st.taz-st.az)*0.07; st.po += (st.tpo-st.po)*0.08; st.r += (st.tr-st.r)*0.08;
      const sp = Math.sin(st.po), cp = Math.cos(st.po);
      camera.position.set(target.x + st.r*sp*Math.sin(st.az), target.y + st.r*cp, target.z + st.r*sp*Math.cos(st.az));
      camera.lookAt(target);
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    frame();

    let current = 'chene', seed, growth = 1;
    document.querySelectorAll('button[data-p]').forEach(b => b.onclick = () => {
      document.querySelectorAll('button[data-p]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); current = b.dataset.p; seed = undefined; load(current, growth, seed);
    });
    document.getElementById('seed').onclick = () => { seed = Math.floor(Math.random()*99999); load(current, growth, seed); };
    const gr = document.getElementById('growth');
    if (gr) gr.oninput = () => { growth = gr.value / 100; load(current, growth, seed); };
    load('chene', 1);
