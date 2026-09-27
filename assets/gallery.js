// Cinta continua. Sin JavaScript queda una galería con desplazamiento nativo.
(function () {
    'use strict';
    const viewport = document.getElementById('gallery-view');
    const track = document.getElementById('gallery-track');
    const original = document.getElementById('gallery-set');
    const toggle = document.getElementById('gallery-toggle');
    const help = document.getElementById('gallery-help');
    if (!viewport || !track.animate) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const hover = matchMedia('(hover: hover) and (pointer: fine)');
    const copy = original.cloneNode(true);
    copy.removeAttribute('id');
    copy.dataset.galleryCopy = '';
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    track.append(copy);

    const speed = 38.4; // Píxeles por segundo: un 20 % más rápida, constante en todos los anchos.
    let distance = original.getBoundingClientRect().width;
    let animation = null;
    let userPaused = false;
    let hovering = false;
    let focused = false;
    let visible = false;

    function offset() {
        const pixels = animation
            ? Number(animation.currentTime || 0) * speed / 1000
            : viewport.scrollLeft;
        return distance > 0 ? pixels % distance : 0;
    }

    function stop() {
        if (!animation) return;
        const left = offset();
        animation.cancel();
        animation = null;
        delete viewport.dataset.playing;
        // Conserva el encuadre al pasar de movimiento automático a scroll manual.
        viewport.scrollTo({ left, behavior: 'instant' });
    }

    function start() {
        if (animation || distance <= 0) return;
        const left = offset();
        viewport.scrollTo({ left: 0, behavior: 'instant' });
        viewport.dataset.playing = 'true';
        animation = track.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-' + distance + 'px)' }
        ], { duration: distance / speed * 1000, easing: 'linear', iterations: Infinity });
        animation.currentTime = left / speed * 1000;
    }

    function sync() {
        const canPlay = visible && !document.hidden && !reduced.matches
            && !userPaused && !hovering && !focused;
        if (canPlay) start(); else stop();
        toggle.hidden = reduced.matches;
        toggle.dataset.paused = String(userPaused);
        toggle.querySelector('span').textContent = userPaused ? 'Reproducir' : 'Pausar';
        toggle.setAttribute('aria-label', (userPaused ? 'Reproducir' : 'Pausar') + ' cinta de fotografías');
    }

    function motionPreference() {
        stop();
        copy.hidden = reduced.matches;
        help.textContent = reduced.matches
            ? 'Desliza o utiliza las flechas del teclado para explorar las fotografías.'
            : 'Las fotografías avanzan automáticamente. Puedes pausar la cinta con el botón. Al tocarla o enfocarla se detiene para que puedas deslizar o usar las flechas del teclado.';
        sync();
    }

    toggle.addEventListener('click', () => { userPaused = !userPaused; sync(); });
    viewport.addEventListener('pointerenter', () => { hovering = hover.matches; sync(); });
    viewport.addEventListener('pointerleave', () => { hovering = false; sync(); });
    viewport.addEventListener('pointerdown', () => { userPaused = true; sync(); });
    viewport.addEventListener('focusin', () => { focused = true; sync(); });
    viewport.addEventListener('focusout', () => { focused = false; sync(); });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', motionPreference);
    hover.addEventListener('change', () => { if (!hover.matches) hovering = false; sync(); });

    new ResizeObserver(() => {
        const width = original.getBoundingClientRect().width;
        if (Math.abs(width - distance) < 0.5) return;
        const progress = distance > 0 ? offset() / distance : 0;
        stop();
        distance = width;
        viewport.scrollTo({ left: progress * distance, behavior: 'instant' });
        sync();
    }).observe(original);

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
            // El bucle incluye también las fotos aún fuera del área visible.
            track.querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
        }
        sync();
    }).observe(viewport);

    motionPreference();
})();
