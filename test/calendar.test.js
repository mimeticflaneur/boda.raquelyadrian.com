'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');

test('calendar and event metadata agree on the ceremony and next-day finish', async () => {
    const fn = html.match(/function downloadCal\(\) \{[\s\S]*?\n    \}/)[0];
    let blob;
    vm.runInNewContext(fn + '\ndownloadCal();', {
        Blob, TextEncoder,
        URL: { createObjectURL: b => { blob = b; return 'blob:test'; }, revokeObjectURL() {} },
        document: { createElement: () => ({ click() {} }) }
    });
    const ics = await blob.text();
    const unfolded = ics.replace(/\r\n /g, '');
    assert.match(unfolded, /DTSTART;TZID=Europe\/Madrid:20270612T133000/);
    assert.match(unfolded, /DTEND;TZID=Europe\/Madrid:20270613T010000/);
    assert.match(unfolded, /Llegada de invitados 13:00h/);
    assert.match(unfolded, /Traslado a la finca 15:00h/);
    assert.match(unfolded, /Cóctel 15:30h/);
    assert.equal(ics.split('\r\n').every(line => Buffer.byteLength(line) <= 75), true);
    const event = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(event.startDate, '2027-06-12T13:30:00+02:00');
    assert.equal(event.endDate, '2027-06-13T01:00:00+02:00');
    assert.equal(new Date(event.endDate) - new Date(event.startDate), 11.5 * 60 * 60 * 1000);
});
