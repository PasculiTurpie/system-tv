import { Handle, Position } from '@xyflow/react';
import dataFlow from "../../utils/contants";
import './CustomNode.css'
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
      <Handle type="target" position={Position.Right} />
      <Handle type="source" position={Position.Left} />
      
      
      {/* Contenedor de la Imagen */}
      <div style={{ marginBottom: '5px' }} className='container__image'>
        <img
          src={data.image} // La URL de la imagen se pasa en data
          alt={data.label}
          style={{ width: '100%', height: '100%', objectFit: 'contain'}}
        />
      </div>
      
      {/* Etiqueta del Nodo */}
      <span className='title__image'>{data.label}</span>
      
    </div>
  );
};

export default CustomNode;