import * as THREE from 'three/webgpu'

const toArr = (v) => Array.isArray(v) ? v : [v]

const opImpls = {
    mul:   (prev, [s]) => (...a) => toArr(prev(...a)).map(v => v * s),
    div:   (prev, [s]) => (...a) => toArr(prev(...a)).map(v => v / s),
    add:   (prev, [s]) => (...a) => toArr(prev(...a)).map(v => v + s),
    sub:   (prev, [s]) => (...a) => toArr(prev(...a)).map(v => v - s),
    floor: (prev)      => (...a) => toArr(prev(...a)).map(Math.floor),
    fract: (prev)      => (...a) => toArr(prev(...a)).map(v => v - Math.floor(v)),
    abs:   (prev)      => (...a) => toArr(prev(...a)).map(Math.abs),
    ceil:  (prev)      => (...a) => toArr(prev(...a)).map(Math.ceil),
    negate:(prev)      => (...a) => toArr(prev(...a)).map(v => -v),
    sin:   (prev)      => (...a) => toArr(prev(...a)).map(Math.sin),
    cos:   (prev)      => (...a) => toArr(prev(...a)).map(Math.cos),
}

export function trackUV(tslNode, initFn) {
    const jsFn = initFn ?? ((u, v) => [u, v])
    return new Proxy(tslNode, {
        get(target, prop) {
            if (prop === '__fn') return jsFn
            const val = Reflect.get(target, prop, target)
            if (typeof val !== 'function') return val
            return (...args) => {
                const result = val.apply(target, args)
                if (prop in opImpls) return trackUV(result, opImpls[prop](jsFn, args))
                return result
            }
        }
    })
}

export function createRGBTooltip({ camera, mesh, scene, sizes, gridUv }) {
    const fmt = (n) => Number.isInteger(n) ? n : n.toFixed(3)
    const uvFn = gridUv?.__fn ?? null

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

    // --- Estado compartido ---
    let hovering = false
    let mouseX = 0, mouseY = 0
    let currentUV = null
    let rgb = [0, 0, 0]

    function updateDisplay() {
        if (!hovering || !currentUV) return
        const u = currentUV.x
        const v = currentUV.y
        const [r, g, b] = rgb
        const color = `rgb(${r},${g},${b})`

        tooltip.innerHTML = `RGB(${r}, ${g}, ${b})<br>UV(${fmt(u)}, ${fmt(v)})`
        tooltip.style.borderLeft = `4px solid ${color}`
        tooltip.style.display = 'block'
        tooltip.style.left = (mouseX + 16) + 'px'
        tooltip.style.top  = (mouseY - 14) + 'px'

        const swatch = `<span style="display:inline-block;width:10px;height:10px;background:${color};border-radius:2px;margin-right:6px;vertical-align:middle"></span>`
        let html = `${swatch}RGB(${r}, ${g}, ${b})<br>UV(${fmt(u)}, ${fmt(v)})`
        if (uvFn) {
            const vals = toArr(uvFn(u, v))
            html += `<br>gridUV(${vals.map(fmt).join(', ')})`
        }
        panel.innerHTML = html
        panel.style.borderLeft = `3px solid ${color}`
    }

    // --- Raycaster en mousemove ---
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    window.addEventListener('mousemove', (event) => {
        mouseX = event.clientX
        mouseY = event.clientY
        mouse.x = (event.clientX / sizes.width) * 2 - 1
        mouse.y = -(event.clientY / sizes.height) * 2 + 1

        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObject(mesh)

        if (intersects.length > 0 && intersects[0].uv) {
            hovering = true
            currentUV = intersects[0].uv
            updateDisplay()
        } else {
            hovering = false
            currentUV = null
            tooltip.style.display = 'none'
            panel.innerHTML = `<span style="opacity:0.5">hover geometry...</span>`
            panel.style.borderLeft = `3px solid #555`
        }
    })

    // --- Pick RT para leer RGB del GPU ---
    const dprInit = window.devicePixelRatio
    const pickRT = new THREE.RenderTarget(
        sizes.width * dprInit,
        sizes.height * dprInit
    )
    window.addEventListener('resize', () => {
        const d = window.devicePixelRatio
        pickRT.setSize(sizes.width * d, sizes.height * d)
    })

    let reading = false

    async function readRGB(renderer) {
        if (!hovering || reading) return
        reading = true
        try {
            const dpr = renderer.getPixelRatio()
            const px = Math.floor(mouseX * dpr)
            const py = Math.floor((sizes.height - mouseY) * dpr)

            // readRenderTargetPixelsAsync retorna los datos, no recibe buffer
            const buf = await renderer.readRenderTargetPixelsAsync(pickRT, px, py, 1, 1)
            rgb = [buf[0], buf[1], buf[2]]
            updateDisplay()
        } catch(e) {
            console.error('RGB read error:', e)
        } finally {
            reading = false
        }
    }

    // tick: render a pickRT primero (sync), luego lee el pixel (async)
    function tick(renderer) {
        renderer.setRenderTarget(pickRT)
        renderer.render(scene, camera)
        renderer.setRenderTarget(null)
        readRGB(renderer)
    }

    return { tick }
}
