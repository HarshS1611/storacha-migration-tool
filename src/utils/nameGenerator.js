const baseNames = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
    'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
    'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron',
    'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon',
    'Phi', 'Chi', 'Psi', 'Omega'
];

const usedNames = new Set();

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function generateRandomName() {
    const randomIndex = getRandomInt(baseNames.length);
    const randomName = baseNames[randomIndex] + '-' + Date.now();
    return randomName;
}

export function createUniqueName() {
    let newName;
    do {
        newName = generateRandomName();
    } while (usedNames.has(newName));
    
    usedNames.add(newName);
    return newName;
}