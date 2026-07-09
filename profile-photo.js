// =========================================================
// PIERRE-OLIVIER — profile-photo.js
//
// La photo de profil est convertie en image compressée (JPEG, base64) et
// envoyée au serveur réel via PO_Auth.updateProfile (PUT /api/auth/me),
// qui la stocke dans la colonne "photo" de la table users (server/db.js).
// Toute la logique de recadrage/redimensionnement/compression reste dans
// le navigateur (API Canvas) ; seul le résultat final (base64) est envoyé.
//
// Limite connue : le stockage en base64 dans SQLite fonctionne bien pour
// ce volume d'utilisateurs, mais un vrai service de fichiers (S3, Supabase
// Storage, etc.) serait préférable si le nombre de clients grossit
// beaucoup — on ne garderait alors qu'une URL dans le profil utilisateur.
// =========================================================

const PO_Photo = (() => {
  const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_UPLOAD_MB = 8;
  const OUTPUT_SIZE = 320;       // dimension finale (carrée) de la photo de profil, en px
  const OUTPUT_QUALITY = 0.85;   // qualité de compression JPEG

  function validateFile(file) {
    if (!file) return { ok: false, error: 'Aucun fichier sélectionné.' };
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return { ok: false, error: 'Format non supporté. Utilisez JPG, PNG ou WEBP.' };
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return { ok: false, error: `Fichier trop volumineux (max ${MAX_UPLOAD_MB} Mo).` };
    }
    return { ok: true };
  }

  function _readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
      reader.readAsDataURL(file);
    });
  }

  function _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Impossible de charger l'image."));
      img.src = src;
    });
  }

  // Construit dynamiquement le markup du recadreur (une seule instance, réutilisée).
  function _ensureCropperDOM() {
    let veil = document.getElementById('po-photo-cropper-veil');
    if (veil) return veil;

    veil = document.createElement('div');
    veil.id = 'po-photo-cropper-veil';
    veil.className = 'modal-veil';
    veil.hidden = true;
    veil.innerHTML = `
      <div class="modal-box po-photo-cropper" role="dialog" aria-modal="true" aria-labelledby="po-photo-cropper-title">
        <h3 id="po-photo-cropper-title">Recadrer la photo</h3>
        <p class="muted-note" style="margin-bottom:14px;">Faites glisser l'image pour la repositionner, ajustez le zoom si besoin.</p>
        <div class="po-photo-cropper__stage" id="po-photo-cropper-stage">
          <canvas id="po-photo-cropper-canvas" width="320" height="320"></canvas>
        </div>
        <div class="field" style="margin-top:14px;">
          <label for="po-photo-cropper-zoom">Zoom</label>
          <input type="range" id="po-photo-cropper-zoom" min="100" max="300" value="100">
        </div>
        <div class="modal-box__actions">
          <button type="button" class="modal-box__cancel" id="po-photo-cropper-cancel">Annuler</button>
          <button type="button" class="auth__submit" id="po-photo-cropper-save" style="width:auto; padding:12px 26px;">Utiliser cette photo</button>
        </div>
      </div>
    `;
    document.body.appendChild(veil);
    return veil;
  }

  // Ouvre le recadreur pour un fichier donné. onSave reçoit la dataURL finale
  // (JPEG compressé, OUTPUT_SIZE x OUTPUT_SIZE). onCancel est optionnel.
  async function openCropper(file, { onSave, onCancel } = {}) {
    const check = validateFile(file);
    if (!check.ok) {
      if (onCancel) onCancel(check.error);
      return;
    }

    let dataUrl, img;
    try {
      dataUrl = await _readFileAsDataURL(file);
      img = await _loadImage(dataUrl);
    } catch (e) {
      if (onCancel) onCancel(e.message);
      return;
    }

    const veil = _ensureCropperDOM();
    const canvas = veil.querySelector('#po-photo-cropper-canvas');
    const ctx = canvas.getContext('2d');
    const zoomInput = veil.querySelector('#po-photo-cropper-zoom');
    const stage = veil.querySelector('#po-photo-cropper-stage');

    // Échelle de base : l'image couvre entièrement le cadre carré (comme un object-fit: cover).
    const baseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
    let zoom = 1; // multiplicateur additionnel au-delà de baseScale, piloté par le slider
    let offsetX = 0, offsetY = 0; // décalage en pixels canvas, contraint pour ne jamais montrer de vide
    let dragging = false, dragStartX = 0, dragStartY = 0, dragOrigX = 0, dragOrigY = 0;

    function clampOffsets() {
      const scale = baseScale * zoom;
      const drawW = img.width * scale, drawH = img.height * scale;
      const maxOffsetX = Math.max(0, (drawW - canvas.width) / 2);
      const maxOffsetY = Math.max(0, (drawH - canvas.height) / 2);
      offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX));
      offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY));
    }

    function draw() {
      clampOffsets();
      const scale = baseScale * zoom;
      const drawW = img.width * scale, drawH = img.height * scale;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.clip();
      ctx.drawImage(
        img,
        canvas.width / 2 - drawW / 2 + offsetX,
        canvas.height / 2 - drawH / 2 + offsetY,
        drawW, drawH
      );
      ctx.restore();
    }
    draw();

    function onPointerDown(e) {
      dragging = true;
      const p = e.touches ? e.touches[0] : e;
      dragStartX = p.clientX; dragStartY = p.clientY;
      dragOrigX = offsetX; dragOrigY = offsetY;
    }
    function onPointerMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      offsetX = dragOrigX + (p.clientX - dragStartX);
      offsetY = dragOrigY + (p.clientY - dragStartY);
      draw();
    }
    function onPointerUp() { dragging = false; }

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    canvas.addEventListener('touchmove', onPointerMove, { passive: true });
    canvas.addEventListener('touchend', onPointerUp);

    zoomInput.value = '100';
    function onZoomInput() {
      zoom = Number(zoomInput.value) / 100;
      draw();
    }
    zoomInput.addEventListener('input', onZoomInput);

    function cleanupListeners() {
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      canvas.removeEventListener('touchmove', onPointerMove);
      canvas.removeEventListener('touchend', onPointerUp);
      zoomInput.removeEventListener('input', onZoomInput);
    }

    function close() {
      cleanupListeners();
      veil.hidden = true;
    }

    const cancelBtn = veil.querySelector('#po-photo-cropper-cancel');
    const saveBtn = veil.querySelector('#po-photo-cropper-save');
    const cancelHandler = () => { close(); if (onCancel) onCancel(null); };
    const saveHandler = () => {
      // Compression finale : on réexporte le canvas (déjà à OUTPUT_SIZE x OUTPUT_SIZE) en JPEG.
      const finalDataUrl = canvas.toDataURL('image/jpeg', OUTPUT_QUALITY);
      close();
      if (onSave) onSave(finalDataUrl);
    };
    cancelBtn.addEventListener('click', cancelHandler, { once: true });
    saveBtn.addEventListener('click', saveHandler, { once: true });

    veil.hidden = false;
    stage.scrollIntoView?.({ block: 'nearest' });
  }

  // Retourne le markup HTML d'un avatar : photo si disponible, sinon initiales
  // sur fond coloré déterministe (basé sur le nom). sizePx contrôle le diamètre.
  function avatarHTML({ photo, firstName, lastName }, sizePx = 40) {
    const initials = `${(firstName || '?').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();
    const style = `width:${sizePx}px; height:${sizePx}px; min-width:${sizePx}px;`;
    if (photo) {
      return `<img class="po-avatar" src="${photo}" alt="" style="${style} border-radius:50%; object-fit:cover;">`;
    }
    const hue = _hashToHue(`${firstName || ''}${lastName || ''}`);
    return `<span class="po-avatar po-avatar--initials" style="${style} border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:${Math.max(10, sizePx * 0.4)}px; background:hsl(${hue},35%,28%); color:#f3e9d8; font-family:var(--serif); flex-shrink:0;">${initials}</span>`;
  }

  function _hashToHue(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 360;
  }

  return { ACCEPTED_TYPES, MAX_UPLOAD_MB, OUTPUT_SIZE, validateFile, openCropper, avatarHTML };
})();
