import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createRGBTooltip, trackUV } from './rgbTooltip.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import {
    uv,
    vec3,
    vec2,
    add,
    positionLocal,
    positionWorld,
    atan,
    PI,
    TWO_PI,
    remap,
    negate
} from 'three/tsl'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.threejs')

// Scene
const scene = new THREE.Scene()

// Loaders
const textureLoader = new THREE.TextureLoader()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.set(1.25, 2, 4)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 1, 0)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x111111)
renderer.inspector = new Inspector()

/**
 * Floor
 */
{

    const textureColor = textureLoader.load('./floor-color.jpg')
    textureColor.colorSpace = THREE.SRGBColorSpace

    const geometry = new THREE.PlaneGeometry(10, 10)

    const material = new THREE.MeshBasicNodeMaterial({ map: textureColor, transparent: true })
    material.opacityNode = uv().sub(0.5).length().smoothstep(0.5, 0.2)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    scene.add(mesh)
}

/**
 * Patterns
 */
// Geometry
const geometry = new THREE.PlaneGeometry(1, 1, 1, 1)

// Material
const material = new THREE.MeshBasicNodeMaterial()
// patter 1
material.colorNode = vec3(uv())
// patter 2
material.colorNode = vec3(uv().x)
// patter 3
material.colorNode = vec3(uv().x.mul(10).fract())
// patter 4
material.colorNode = vec3(
    add(
        uv().x.mul(10).fract().step(0.5),
        uv().y.mul(10).fract().step(0.5)
    ).sub(1).abs()
)
// patter 5
//material.colorNode = vec3(positionLocal)
material.colorNode = vec3(uv().sub(0.5))
//material.colorNode = vec3(uv().sub(0.5).length())

// pattern 6
const polarUv = uv().sub(0.5)
const angle = atan(polarUv.x, polarUv.y)
//material.colorNode = vec3(angle.add(PI).div(TWO_PI))
//material.colorNode = vec3(angle)
material.colorNode = vec3(angle.remap(PI.negate(), PI, 0,1))

// pattern 6
const gridUv = trackUV(uv()).mul(10).floor()
material.colorNode = vec3(gridUv)


// Mesh
const mesh = new THREE.Mesh(geometry, material)
mesh.position.y = 1
scene.add(mesh)





/**
 * RGB Tooltip Addon
 */
createRGBTooltip({ camera, mesh, sizes, gridUv })

/**
 * Animate
 */
const timer = new THREE.Timer()

const tick = () =>
{
    timer.update()
    controls.update()

    renderer.render(scene, camera)
}

renderer.setAnimationLoop(tick)
