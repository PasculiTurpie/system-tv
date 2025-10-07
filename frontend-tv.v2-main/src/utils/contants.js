const dataFlow = {
    nameChannel: "DREAMWORKS",
    numberChannelSur: "3",
    numberChannelCn: "3",
    logoChannel: "https://i.ibb.co/KX2gxHz/Dreamworks.jpg",
    severidadChannel: "4",
    tipoTecnologia: "Cobre",
    contacto: [
        {
            nombreContact: "Jorge Sepúlveda",
            email: "jsepulveda@gmail.com",
            telefono: "+56 9 88776655",
        },
    ],
    nodes: [
        {
            id: "1",
            type: "image",
            position: { x: 350, y: 0 },
            data: {
                label: "IS-21",
                image: "https://i.ibb.co/m5dxbBRh/parabolic.png",
            },
        },
        {
            id: "2",
            type: "image",
            position: { x: 250, y: 200 },
            data: {
                label: "IRD Cisco D9859",
                image: "https://i.ibb.co/pvW06r6K/ird-motorola.png",
            },
        },
        {
            id: "3",
            type: "image",
            position: { x: 450, y: 200 },
            data: {
                label: "IRD Cisco D9859",
                image: "https://i.ibb.co/pvW06r6K/ird-motorola.png",
            },
        },
    ],
    edges: [
        {
            id: "e1-1",
            source: "1",
            target: "2",
            data: {
                bandwidth: "10Gbps",
                protocolo: "UDP",
            },
        },
        {
            id: "e1-2",
            source: "1",
            target: "3",
            data: {
                bandwidth: "10Gbps",
                protocolo: "UDP",
            },
        },
        {
            id: "e1-3",
            source: "1",
            target: "3",
            data: {
                bandwidth: "10Gbps",
                protocolo: "UDP",
            },
        },
    ],
};

 

export default dataFlow;
