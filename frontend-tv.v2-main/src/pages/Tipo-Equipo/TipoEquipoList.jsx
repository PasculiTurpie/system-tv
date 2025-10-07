import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";

const TipoEquipoList = () => {

    const [tipoEquipo, setTipoEquipo] = useState([])

    const typeEquitment = api.getTipoEquipo()
        .then((res)=>{
            setTipoEquipo(res.data)
            console.log(tipoEquipo)
        })


    return (
        <>
            <div className="outlet-main">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <Link to="/register-type-equitment">Formulario</Link>
                        </li>
                        <li
                            className="breadcrumb-item active"
                            aria-current="page"
                        >
                            Listar
                        </li>
                    </ol>
                </nav>
                <h1>Listar de Tipo Equipo</h1>
            </div>
        </>
    );
};

export default TipoEquipoList;
