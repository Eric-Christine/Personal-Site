console.log('connected')

let projectCards = document.querySelectorAll('.card');
const logo = document.querySelector('#logo')

projectCards.forEach((card) => {
    card.addEventListener('click', function () {
        console.log('easter egg')
    })
})

// Holo card: glare and tilt follow the pointer
document.querySelectorAll('.holo').forEach((card) => {
    card.addEventListener('pointermove', function (e) {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width
        const y = (e.clientY - r.top) / r.height
        card.style.setProperty('--mx', `${x * 100}%`)
        card.style.setProperty('--my', `${y * 100}%`)
        card.style.setProperty('--rx', `${(0.5 - y) * 12}deg`)
        card.style.setProperty('--ry', `${(x - 0.5) * 12}deg`)
    })
    card.addEventListener('pointerleave', function () {
        ['--mx', '--my', '--rx', '--ry'].forEach((v) => card.style.removeProperty(v))
    })
})

if (logo) {
    logo.addEventListener('click', function () {
        console.log('Thank you for checking out my website! If you would like to reach out to me, please email ejcdevs@gmail.com')
    })
}
