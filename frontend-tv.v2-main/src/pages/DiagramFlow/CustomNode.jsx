import { Handle, Position } from '@xyflow/react';
import dataFlow from "../../utils/contants";
const CustomNode = ({ data, selected }) => {



    
  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''}`}
      style={{
        border: selected ? '2px solid #007bff' : '1px solid #ccc',
        borderRadius: '5px',
        padding: '10px',
        width: '120px',
        textAlign: 'center',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} />

      
      
      {/* Contenedor de la Imagen */}
      <div style={{ marginBottom: '5px' }}>
        <img
          src={data.image} // La URL de la imagen se pasa en data
          alt={data.label}
          style={{ width: '60px', height: '60px', objectFit: 'contain' }}
        />
      </div>
      
      {/* Etiqueta del Nodo */}
      <strong>{data.label}</strong>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomNode;