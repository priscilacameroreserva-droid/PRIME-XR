import * as THREE from 'three';

let activeSession = null;
let renderer = null;

const joint = (hand, name) => hand?.joints?.[name] || null;
const worldPoint = (object) => {
  if (!object) return null;
  const p = new THREE.Vector3();
  object.getWorldPosition(p);
  return p;
};

function makeController(isLeft) {
  const root = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.48, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x080a0d, roughness: 0.65 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x48aaff, emissive: 0x123c66, emissiveIntensity: 0.65 });
  const white = new THREE.MeshStandardMaterial({ color: 0xbfc8d4, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.043, 24, 18), black);
  body.scale.set(0.82, 1.12, 0.72);
  body.position.set(0, 0.015, 0);
  root.add(body);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.115, 16), black);
  grip.position.set(0, -0.075, 0.018);
  grip.rotation.x = -0.18;
  root.add(grip);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.008, 10, 36), black);
  ring.position.set(0, 0.065, -0.005);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(0.82, 1.18, 1);
  root.add(ring);

  const ringAccent = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.0024, 6, 36), blue);
  ringAccent.position.copy(ring.position);
  ringAccent.rotation.copy(ring.rotation);
  ringAccent.scale.copy(ring.scale);
  root.add(ringAccent);

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.008, 20), dark);
  stick.position.set(isLeft ? -0.021 : 0.021, 0.032, -0.034);
  root.add(stick);
  const stickTop = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.004, 20), white);
  stickTop.position.set(isLeft ? -0.021 : 0.021, 0.038, -0.034);
  root.add(stickTop);

  const buttonA = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.004, 16), dark);
  buttonA.position.set(isLeft ? 0.02 : -0.02, 0.031, -0.025);
  root.add(buttonA);
  const buttonB = buttonA.clone();
  buttonB.position.x *= -1;
  buttonB.position.z -= 0.014;
  root.add(buttonB);

  const trigger = new THREE.Group();
  trigger.position.set(0, 0.049, 0.028);
  const triggerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.009, 0.023), dark);
  triggerMesh.position.z = -0.006;
  trigger.add(triggerMesh);
  root.add(trigger);

  root.userData.trigger = trigger;
  root.visible = false;
  return root;
}

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f4f7fb';
  ctx.font = '700 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 82);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addDock(scene, camera) {
  const dock = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.34, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x171d27, roughness: 0.65, metalness: 0.12 })
  );
  dock.add(panel);

  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.09),
    new THREE.MeshBasicMaterial({ map: makeLabel('PRIME-XR'), transparent: true, depthWrite: false })
  );
  title.position.set(0, 0.105, 0.021);
  dock.add(title);

  const actions = [
    ['INÍCIO', 'home'],
    ['NAVEGADOR', 'browser'],
    ['MÃOS', 'hands'],
    ['SAIR VR', 'exit']
  ];
  const hitTargets = [];
  actions.forEach(([label, action], i) => {
    const x = (i - 1.5) * 0.215;
    const button = new THREE.Mesh(
      new THREE.BoxGeometry(0.195, 0.105, 0.018),
      new THREE.MeshStandardMaterial({ color: 0x293647, emissive: 0x0b1a2c, roughness: 0.5 })
    );
    button.position.set(x, -0.075, 0.03);
    button.userData.action = action;
    dock.add(button);
    const text = new THREE.Mesh(
      new THREE.PlaneGeometry(0.175, 0.055),
      new THREE.MeshBasicMaterial({ map: makeLabel(label), transparent: true, depthWrite: false })
    );
    text.position.set(x, -0.075, 0.041);
    dock.add(text);
    hitTargets.push(button);
  });

  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();
  camera.getWorldDirection(direction);
  camera.getWorldPosition(position);
  dock.position.copy(position).add(direction.multiplyScalar(1.35));
  dock.position.y -= 0.18;
  dock.lookAt(position);
  scene.add(dock);
  return { dock, hitTargets };
}

export async function startQuestXR(onStatus = () => {}) {
  if (!navigator.xr) {
    onStatus('WebXR não está disponível neste navegador. Abra o PRIME-XR no navegador do Meta Quest.');
    return false;
  }
  const supported = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!supported) {
    onStatus('Este navegador não oferece uma sessão VR imersiva.');
    return false;
  }
  try {
    activeSession = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['hand-tracking', 'local-floor']
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080d15);
    const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 30);
    const hemi = new THREE.HemisphereLight(0xdcecff, 0x18202d, 2.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.5, 2, 1);
    scene.add(key);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.setSize(innerWidth, innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.domElement.id = 'prime-xr-canvas';
    renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1000;background:#080d15';
    document.body.appendChild(renderer.domElement);

    const hands = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
    const models = [makeController(true), makeController(false)];
    hands.forEach((hand, i) => { scene.add(hand); scene.add(models[i]); });

    const { hitTargets } = addDock(scene, camera);
    const raycaster = new THREE.Raycaster();
    const previousPinch = [false, false];
    const tempMatrix = new THREE.Matrix4();
    let ended = false;

    const updateController = (i) => {
      const hand = hands[i];
      const model = models[i];
      const wrist = joint(hand, 'wrist');
      const indexBase = joint(hand, 'index-finger-metacarpal');
      const thumbBase = joint(hand, 'thumb-metacarpal');
      const indexTip = joint(hand, 'index-finger-tip');
      const thumbTip = joint(hand, 'thumb-tip');
      if (!wrist || !indexBase || !thumbBase || !indexTip || !thumbTip) {
        model.visible = false;
        previousPinch[i] = false;
        return;
      }
      const wp = worldPoint(wrist);
      const ip = worldPoint(indexBase);
      const tp = worldPoint(thumbBase);
      const it = worldPoint(indexTip);
      const tt = worldPoint(thumbTip);
      if (!wp || !ip || !tp || !it || !tt) return;

      const xAxis = tp.sub(wp).normalize();
      const yAxis = ip.sub(wp).normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
      yAxis.crossVectors(zAxis, xAxis).normalize();
      tempMatrix.makeBasis(xAxis, yAxis, zAxis);
      model.position.copy(wp);
      model.quaternion.setFromRotationMatrix(tempMatrix);
      model.visible = true;

      const pinchDistance = it.distanceTo(tt);
      const pinching = pinchDistance < 0.027;
      model.userData.trigger.rotation.x = pinching ? -0.42 : 0;
      if (pinching && !previousPinch[i]) {
        const direction = it.clone().sub(wp).normalize();
        raycaster.set(wp, direction);
        const hit = raycaster.intersectObjects(hitTargets, false)[0];
        if (hit?.object?.userData?.action) {
          window.dispatchEvent(new CustomEvent('prime-xr-action', { detail: hit.object.userData.action }));
        }
      }
      previousPinch[i] = pinching;
    };

    activeSession.addEventListener('end', () => {
      ended = true;
      renderer?.setAnimationLoop(null);
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
      activeSession = null;
      onStatus('Sessão VR encerrada.');
    });

    await renderer.xr.setSession(activeSession);
    onStatus('VR iniciado. Mostre as duas mãos e faça pinça para clicar.');
    renderer.setAnimationLoop(() => {
      updateController(0);
      updateController(1);
      renderer.render(scene, camera);
    });
    return true;
  } catch (error) {
    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
      renderer = null;
    }
    if (activeSession) {
      await activeSession.end().catch(() => {});
      activeSession = null;
    }
    onStatus('Não foi possível iniciar o VR: ' + (error?.message || error));
    return false;
  }
}

export async function stopQuestXR() {
  if (activeSession) await activeSession.end();
}
