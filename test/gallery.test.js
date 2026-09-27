'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../assets/gallery.js'), 'utf8');

// A controllable browser clock lets us exercise the wrap without waiting a full lap.
function setup({ reducedMotion = false } = {}) {
    const events = () => ({
        handlers: {},
        addEventListener(name, fn) { this.handlers[name] = fn; },
        fire(name) { this.handlers[name]?.(); }
    });
    const element = () => Object.assign(events(), {
        dataset: {}, attrs: {}, hidden: false, scrollLeft: 0,
        setAttribute(name, value) { this.attrs[name] = value; },
        removeAttribute(name) { delete this.attrs[name]; },
        scrollTo({ left }) { this.scrollLeft = left; }
    });
    const viewport = element();
    const original = element();
    let width = 3200;
    original.getBoundingClientRect = () => ({ width });
    const copy = element();
    original.cloneNode = () => copy;
    const track = element();
    const images = [{ loading: 'lazy' }, { loading: 'lazy' }];
    const animations = [];
    track.append = child => { track.copy = child; };
    track.querySelectorAll = () => images;
    track.animate = (frames, options) => {
        const animation = { frames, options, currentTime: 0, cancelled: false,
            cancel() { this.cancelled = true; } };
        animations.push(animation);
        return animation;
    };
    const toggle = element();
    const label = {};
    toggle.querySelector = () => label;
    const help = element();
    const elements = { 'gallery-view': viewport, 'gallery-track': track,
        'gallery-set': original, 'gallery-toggle': toggle, 'gallery-help': help };
    const document = Object.assign(events(), { hidden: false, getElementById: id => elements[id] });
    const reduced = Object.assign(events(), { matches: reducedMotion });
    const hover = Object.assign(events(), { matches: true });
    let resize, intersection;
    vm.runInNewContext(source, { document,
        matchMedia: query => query.includes('reduced-motion') ? reduced : hover,
        ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} },
        IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} }
    });
    return { viewport, original, copy, toggle, label, document, reduced, images, animations,
        active: () => animations.at(-1),
        show: visible => intersection([{ isIntersecting: visible }]),
        resize: value => { width = value; resize(); }
    };
}

test('continuous lap wraps seamlessly and pause/resume keeps the visible photo position', () => {
    const s = setup();
    s.show(true);
    assert.equal(s.copy.attrs['aria-hidden'], 'true');
    assert.equal(s.copy.inert, true);
    assert.equal(s.active().options.iterations, Infinity);
    assert.equal(s.active().options.easing, 'linear');
    assert.equal(s.active().frames[1].transform, 'translateX(-3200px)');
    s.active().currentTime = s.active().options.duration * 1.25;
    s.toggle.fire('click');
    assert.equal(s.viewport.scrollLeft, 800);
    assert.equal(s.active().cancelled, true);
    assert.equal(s.label.textContent, 'Reproducir');
    s.viewport.scrollLeft = 1200; // Guests can browse manually while paused.
    s.toggle.fire('click');
    assert.equal(s.active().currentTime, 37500);
    assert.equal(s.viewport.scrollLeft, 0);
    assert.equal(s.images.every(img => img.loading === 'eager'), true);
});

test('reduced motion stays manual, and enabling it stops an existing animation', () => {
    const initial = setup({ reducedMotion: true });
    initial.show(true);
    assert.equal(initial.animations.length, 0);
    assert.equal(initial.copy.hidden, true);
    assert.equal(initial.toggle.hidden, true);
    const s = setup();
    s.show(true);
    s.active().currentTime = 1000;
    s.reduced.matches = true;
    s.reduced.fire('change');
    assert.equal(s.active().cancelled, true);
    assert.equal(s.viewport.scrollLeft, 32);
    assert.equal(s.copy.hidden, true);
});

test('hover, focus and tab visibility suspend playback; touch remains paused until requested', () => {
    const s = setup();
    s.show(true);
    s.viewport.fire('pointerenter');
    assert.equal(s.active().cancelled, true);
    s.viewport.fire('pointerleave');
    assert.equal(s.active().cancelled, false);
    s.viewport.fire('focusin');
    assert.equal(s.active().cancelled, true);
    s.viewport.fire('focusout');
    assert.equal(s.active().cancelled, false);
    s.document.hidden = true;
    s.document.fire('visibilitychange');
    assert.equal(s.active().cancelled, true);
    s.document.hidden = false;
    s.document.fire('visibilitychange');
    s.viewport.fire('pointerdown');
    s.show(false);
    s.show(true);
    assert.equal(s.active().cancelled, true);
    assert.equal(s.label.textContent, 'Reproducir');
});

test('resizing preserves lap progress and recomputes travel at the same speed', () => {
    const s = setup();
    s.show(true);
    s.active().currentTime = 25000;
    s.resize(1600);
    assert.equal(s.active().currentTime, 12500);
    assert.equal(s.active().options.duration, 50000);
    s.show(false);
    assert.equal(s.viewport.scrollLeft, 400);
    s.show(true);
    assert.equal(s.active().currentTime, 12500);
});
