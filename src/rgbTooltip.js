import * as THREE from 'three/webgpu'

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
export const fract = (v) => v - Math.floor(v)
export const step  = (edge, v) => v < edge ? 0 : 1

export function createRGBTooltip({ camera, mesh, sizes }) {
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
    `
    document.body.appendChild(tooltip)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // colorFn(u, v) → [r, g, b] en rango 0–1, espeja el colorNode activo
    // Espeja: vec3(uv().mul(10))  →  gridUv pattern
    let colorFn = (u, v) => [u * 10, v * 10, 0]

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

            tooltip.textContent = `RGB(${r}, ${g}, ${b})`
            tooltip.style.borderLeft = `4px solid rgb(${r},${g},${b})`
            tooltip.style.display = 'block'
            tooltip.style.left = (event.clientX + 16) + 'px'
            tooltip.style.top  = (event.clientY - 14) + 'px'
        } else {
            tooltip.style.display = 'none'
        }
    })

    return {
        setColorFn: (fn) => { colorFn = fn }
    }
}