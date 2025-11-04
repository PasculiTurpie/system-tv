import { Handle, Position } from "@xyflow/react";
import dataFlow from "../../utils/contants";
import "./CustomNode.css";
const CustomNode = ({ data, selected }) => {
    const leftPerc = [10, 35, 60, 85]; // lado izquierdo (vertical => usar top)
    const rightPerc = [10, 35, 60, 85]; // lado derecho
    const topPerc = [10, 40, 70, 90]; // borde superior (horizontal => usar left)
    const bottomPerc = [10, 40, 70, 90];

    return (
        <div
            className={`custom-node ${selected ? "selected" : ""}`}
            style={{
                border: selected ? "2px solid #007bff" : "1px solid #ccc",
                borderRadius: "5px",
                padding: "10px",
                width: "120px",
                textAlign: "center",
                backgroundColor: "#fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
        >
            {/* LEFT: targets a distintas alturas */}
            {leftPerc.map((p, i) => (
                <Handle
                    key={`in-left-${i + 1}`}
                    id={`in-left-${i + 1}`}
                    type="target"
                    position={Position.Right}
                    style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 1}}
                />
                
            ))}
            {leftPerc.map((p, i) => (
                <Handle
                    key={`out-left-${i + 1}`}
                    id={`out-left-${i + 1}`}
                    type="source"
                    position={Position.Right}
                    style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 1}}
                />
                
            ))}

            {/* RIGHT: sources a distintas alturas */}
            {rightPerc.map((p, i) => (
                <Handle
                    key={`out-right-${i + 1}`}
                    id={`out-right-${i + 1}`}
                    type="source"
                    position={Position.Left}
                    style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 1 }}
                />
            ))}
            {/* RIGHT: sources a distintas alturas */}
            {rightPerc.map((p, i) => (
                <Handle
                    key={`in-right-${i + 1}`}
                    id={`in-right-${i + 1}`}
                    type="target"
                    position={Position.Left}
                    style={{ top: `${p}%`, transform: "translateY(-50%)", opacity: 1 }}
                />
            ))}

            {/* TOP: sources a distintos anchos */}
            {topPerc.map((p, i) => (
                <Handle
                    key={`out-top-${i + 1}`}
                    id={`out-top-${i + 1}`}
                    type="source"
                    position={Position.Top}
                    style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 1 }}
                />
            ))}
            {topPerc.map((p, i) => (
                <Handle
                    key={`in-top-${i + 1}`}
                    id={`in-top-${i + 1}`}
                    type="target"
                    position={Position.Top}
                    style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 1 }}
                />
            ))}

            {/* BOTTOM: targets a distintos anchos */}
            {bottomPerc.map((p, i) => (
                <Handle
                    key={`in-bottom-${i + 1}`}
                    id={`in-bottom-${i + 1}`}
                    type="target"
                    position={Position.Bottom}
                    style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 1 }}
                />
            ))}

            {/* BOTTOM: targets a distintos anchos */}
            {bottomPerc.map((p, i) => (
                <Handle
                    key={`out-bottom-${i + 1}`}
                    id={`out-bottom-${i + 1}`}
                    type="source"
                    position={Position.Bottom}
                    style={{ left: `${p}%`, transform: "translateX(-50%)", opacity: 1 }}
                />
            ))}

            {/* Contenedor de la Imagen */}
            <div style={{ marginBottom: "2px" }} className="container__image">
                <img
                    src={data.image} // La URL de la imagen se pasa en data
                    alt={data.label}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                    }}
                />
            </div>

            {/* Etiqueta del Nodo */}
            <span className="title__image">{data.label}</span>
        </div>
    );
};

export default CustomNode;
