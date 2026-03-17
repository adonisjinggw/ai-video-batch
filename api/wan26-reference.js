export const config = { runtime: 'edge' };

const PNG_BASE64 = [
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAB+0lEQVR42u3TQQkA',
    'AAjAwPUvrW8zeHAJBqsJ/pIAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYA',
    'A4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4ABwABgADAAGAAMAAYAA4AB',
    'wABgADAAGAAMAAYAA4ABwAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAY',
    'AAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwA',
    'BgADgAHAAGAAMAAYAAwABgAJMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAA',
    'MAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAY',
    'AAwABgADgAHAAGAAMAAYAAyAASTAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgAD',
    'gAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHAAGAAMAAYAAwABgADgAHA',
    'AGAAMAAYAAwABgADgAHAAGAAMAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgA',
    'DAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAGAAOAAcAAYAAwABgADAAG',
    'AAOAAcAAYAAwABgADADXAkpbDvIClpwPAAAAAElFTkSuQmCC'
].join('');

function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

const IMAGE_BYTES = decodeBase64(PNG_BASE64);

export default function handler(request) {
    const headers = {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': 'image/png',
        'Content-Length': String(IMAGE_BYTES.length),
        'Content-Disposition': 'inline; filename="wan26-reference.png"'
    };

    if (request.method === 'HEAD') {
        return new Response(null, { status: 200, headers });
    }

    if (request.method !== 'GET') {
        return new Response('METHOD_NOT_ALLOWED', { status: 405, headers });
    }

    return new Response(IMAGE_BYTES, { status: 200, headers });
}
