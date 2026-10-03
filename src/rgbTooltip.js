import * as THREE from 'three/webgpu'

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
export const fract = (v) => v - Math.floor(v)
export const step  = (edge, v) => v < edge ? 0 : 1

// Operaciones soportadas para el tracker
const opImpls = {
    mul:   (prev, [s]) => (u, v) => { const [x, y] = prev(u, v); return [x * s, y * s] },
    div:   (prev, [s]) => (u, v) => { const [x, y] = prev(u, v); return [x / s, y / s] },
    add:   (prev, [s]) => (u, v) => { const [x, y] = prev(u, v); return [x + s, y + s] },
    sub:   (prev, [s]) => (u, v) => { const [x, y] = prev(u, v); return [x - s, y - s] },
    floor: (prev)      => (u, v) => { const [x, y] = prev(u, v); return [Math.floor(x), Math.floor(y)] },
    fract: (prev)      => (u, v) => { const [x, y] = prev(u, v); return [x - Math.floor(x), y - Math.floor(y)] },
    abs:   (prev)      => (u, v) => { const [x, y] = prev(u, v); return [Math.abs(x), Math.abs(y)] },
    ceil:  (prev)      => (u, v) => { const [x, y] = prev(u, v); return [Math.ceil(x), Math.ceil(y)] },
}

/**
 * trackUV(tslNode) — wrappea un nodo TSL y trackea operaciones para generar fn JS automaticamente.
 * Uso: const gridUv = trackUV(uv()).mul(10).floor()
 *      gridUv.__fn  →  (u, v) => [x, y]
 */
export function trackUV(tslNode, jsFn = (u, v) => [u, v]) {
    return new Proxy(tslNode, {
        get(target, prop) {
            if (prop === '__fn') return jsFn

            const val = Reflect.get(target, prop, target)
            if (typeof val !== 'function') return val

            return (...args) => {
                const result = val.apply(target, args)
                if (prop in opImpls) {
                    const newFn = opImpls[prop](jsFn, args)
                    return trackUV(result, newFn)
                }
                return result
            }
        }
    })
}

export function createRGBTooltip({ camera, mesh, sizes, colorFn: initColorFn, gridUv }) {
    // --- Tooltip flotante ---
    const tooltip = document.createElement('div')
    tooltip.style.cssText = `
        position: fixed;
        background: rgba(0,0,0,0.85);
        color: #fff;
        padding: 6px 10px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 13px;
        pointer-events: none;
        display: none;
        z-index: 9999;
        border-left: 4px solid #fff;
        white-space: nowrap;
        line-height: 1.6;
    `
    document.body.appendChild(tooltip)

    // --- Panel fijo ---
    const panel = document.createElement('div')
    panel.style.cssText = `
        position: fixed;
        top: 16px;
        left: 16px;
        background: rgba(0,0,0,0.75);
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 12px;
        pointer-events: none;
        z-index: 9999;
        line-height: 1.8;
        border-left: 3px solid #555;
        min-width: 160px;
    `
    panel.innerHTML = `<span style="opacity:0.5">hover geometry...</span>`
    document.body.appendChild(panel)

    let colorFn = initColorFn ?? ((u, v) => [u * 10, v * 10, 0])
    const uvFn = gridUv?.__fn ?? null

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / sizes.width) * 2 - 1
        mouse.y = -(event.clientY / sizes.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObject(mesh)

        if (intersects.length > 0 && intersects[0].uv) {
            const { x: u, y: v } = intersects[0].uv

            const [cr, cg, cb] = colorFn(u, v)
            const r = Math.round(clamp(cr, 0, 1) * 255)
            const g = Math.round(clamp(cg, 0, 1) * 255)
            const b = Math.round(clamp(cb, 0, 1) * 255)
            const color = `rgb(${r},${g},${b})`
            const fmt = (n) => Number.isInteger(n) ? n : n.toFixed(3)

            // tooltip flotante
            tooltip.innerHTML = `RGB(${r}, ${g}, ${b})<br>UV(${fmt(u)}, ${fmt(v)})`
            tooltip.style.borderLeft = `4px solid ${color}`
            tooltip.style.display = 'block'
            tooltip.style.left = (event.clientX + 16) + 'px'
            tooltip.style.top  = (event.clientY - 14) + 'px'

            // panel fijo
            const swatch = `<span style="display:inline-block;width:10px;height:10px;background:${color};border-radius:2px;margin-right:6px;vertical-align:middle"></span>`
            let html = `${swatch}RGB(${r}, ${g}, ${b})<br>UV(${fmt(u)}, ${fmt(v)})`
            if (uvFn) {
                const [gx, gy] = uvFn(u, v)
                html += `<br>gridUV(${fmt(gx)}, ${fmt(gy)})`
            }
            panel.innerHTML = html
            panel.style.borderLeft = `3px solid ${color}`
        } else {
            tooltip.style.display = 'none'
            panel.innerHTML = `<span style="opacity:0.5">hover geometry...</span>`
            panel.style.borderLeft = `3px solid #555`
        }
    })

    return {
        setColorFn: (fn) => { colorFn = fn }
    }
}
