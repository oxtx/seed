const Lines = [
    "Trifolium pratenseNCO",
    "RYEGRASS, ANNUALAnnual",
    "FESCUE, TALLAdventure II",
    "Vicia benghalensisPurple",
    "BLUEGRASS,KENTUCKYKentucky",
    "SUB CLOVERCampeda NCO",
    "ROSE CLOVERHykon NCO",
    "CLOVER, CRIMSONNCO"
];


const datas = [];

const constants = ["NCO", "VNS", "DENSIFLORUS", "UC"];

function extractNameVariety(line) {
    let index = -1;
    if (isUpperCase(line[1])) {
        for (let j = 0; j < line.length; j++) {
            if (line[j] >= "a" && line[j] <= "z") {
                index = j;
                break;
            }
        }
        if (index === -1) {
            for (const constant of constants) {
                const index = line.indexOf(constant);
                if (index !== -1) {
                    return [line.slice(0, index), line.slice(index)];
                }
            }
        } else {
            return [line.slice(0, index - 1), line.slice(index - 1)];
        }
    } else {
        for (let j = 1; j < line.length; j++) {
            if (line[j] >= "A" && line[j] <= "Z") {
                index = j;
                break;
            }
        }
        if (index === -1) {
            // datas.push(line)
        } else {
            return [line.slice(0, index), line.slice(index)];
        }
    }
    return [line, line];
    // console.log('index', index, '  ', datas[datas.length - 1]);
}


function isUpperCase(char) {
    return char >= "A" && char <= "Z";
}

for (let i = 0; i < Lines.length; i++) {
    datas.push(extractNameVariety(Lines[i]));
}
// console.log(datas, 'datas');

module.exports = { extractNameVariety };
