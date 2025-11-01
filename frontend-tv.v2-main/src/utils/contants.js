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
            type: "imageNode",
            position: { x: 350, y: 0 },
            data: {
                label: "IS-21",
                image: "https://i.ibb.co/23VpLD2N/satelite.jpg",
            },
        },
        {
            id: "2",
            type: "imageNode",
            position: { x: 150, y: 200 },
            data: {
                label: "IRD Cisco D9859",
                image: "https://i.ibb.co/fGM5NTcX/ird.jpg",
            },
        },
        {
            id: "3",
            type: "imageNode",
            position: { x: 550, y: 200 },
            data: {
                label: "Titan121",
                image: "https://i.ibb.co/wrJZLrqR/titan.jpg",
            },
        },
    ],
    edges: [
        {
            id: "e1-1",
            source: "1",
            target: "2",
            label: "Vuelta",
            type: "smoothstep", // lineal | bezier | smoothstep | step
            animated: true,
            style: {
                stroke: "green",
            },
            data: {
                bandwidth: "10Gbps",
                protocolo: "UDP",
            },
            markerEnd: {
                type: "arrowclosed",
                color: "green",
            },
        },
        {
            id: "e1-2",
            source: "3",
            target: "1",
            type: "smoothstep", // lineal | bezier | smoothstep | step
            animated: true,
            label:'Ida',
            style: {
                stroke: "red",
            },
            data: {
                bandwidth: "10Gbps",
                protocolo: "UDP",
            },
             markerEnd: {
                type: "arrowclosed",
                color: "red",
            },
        }
    ],
};

export default dataFlow;
