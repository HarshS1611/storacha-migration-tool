const baseNames: string[] = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
    'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa',
    'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron',
    'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon',
    'Phi', 'Chi', 'Psi', 'Omega'
];

const usedNames: Set<string> = new Set();

function getRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function generateRandomName(): string {
    const randomIndex = getRandomInt(baseNames.length);
    const randomName = `${baseNames[randomIndex]}-${Date.now()}`;
    return randomName;
}

export function createUniqueName(): string {
    let name = generateRandomName();
    while (usedNames.has(name)) {
        name = generateRandomName();
    }
    usedNames.add(name);
    return name;
}
